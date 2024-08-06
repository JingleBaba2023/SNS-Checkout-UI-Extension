import React, { useEffect, useState } from "react";
import {
  reactExtension,
  useCartLines,
  useTotalAmount,
  useApplyCartLinesChange,
  useBuyerJourneyIntercept,
  Banner
} from "@shopify/ui-extensions-react/checkout";

// Set up the entry point for the extension
export default reactExtension("purchase.checkout.block.render", () => <App />);

function App() {
  const applyCartLinesChange = useApplyCartLinesChange();
  const [showError, setShowError] = useState(false);
  const [adding, setAdding] = useState(false);
  const [freeProductsCount, updateFreeProductsCount] = useState(0);
  const [rebuyTiers, setRebuyTiers] = useState(false);
  const lines = useCartLines();
  const {amount:totalPrice} = useTotalAmount()
  const [removedComplimentaryProducts, updateComplimentaryProductFlag] = useState(false);
  const [lineItemsData, setLineItemsData] = useState([])
  const graphQlUrl = `https://sports-nutrition-source-canada.myshopify.com/api/2023-10/graphql.json`;
  const accessToken = "d199d7b1934bb49ef55c92ffd695421d"; 
  

  const fetchProduct = async (id) => {
    const headers = new Headers();
    headers.append("X-Shopify-Storefront-Access-Token", accessToken);
    headers.append("Content-Type", "application/json");
    const query = `query product ($id: ID) { product(id: $id) {tags  collections(first: 30) {
      nodes {
        id
      }
    } }}`
    const variables = { id }

    const graphql = JSON.stringify({
      query,
      variables
    })
    const requestOptions = {
      method: 'POST',
      headers: headers,
      body: graphql
    };

    const productData = await fetch(graphQlUrl, requestOptions);
    const productJson = await productData.json();
    return productJson;
  }

  const fetchPage = async () => {
    const headers = new Headers();
    headers.append("X-Shopify-Storefront-Access-Token", accessToken);
    headers.append("Content-Type", "application/json");
    const query = `query page ($handle: String) {
      page(handle: $handle) {
        title
        complimentarySettings:metafield(namespace:"custom", key: "complimentary_product_settings") {
          value
        }
      }
    }`
    const variables = { handle: 'global-data-for-checkout-ui-extension-do-not-delete' }

    const graphql = JSON.stringify({
      query,
      variables
    })
    const requestOptions = {
      method: 'POST',
      headers: headers,
      body: graphql
    };

    const pageData = await fetch(graphQlUrl, requestOptions);
    const pageJson = await pageData.json();
    return pageJson;
  }

  const fetchMetaobject = async (id) => {
    const headers = new Headers();
    headers.append("X-Shopify-Storefront-Access-Token", accessToken);
    headers.append("Content-Type", "application/json");
    const query = `query metaobject ($id: ID) {
      metaobject(id: $id) {
        variant:field(key: "product_variant") {
          value
        }
        collection:field(key: "related_collection") {
          value
        }
      }
    }`
    const variables = { id }

    const graphql = JSON.stringify({
      query,
      variables
    })
    const requestOptions = {
      method: 'POST',
      headers: headers,
      body: graphql
    };

    const metaObjectData = await fetch(graphQlUrl, requestOptions);
    const metaObjectJson = await metaObjectData.json();
    return metaObjectJson;
  }



  useBuyerJourneyIntercept(
    ({ canBlockProgress }) => {
      console.log(lines.length);
      console.log(freeProductsCount);
      return canBlockProgress && lines.length == freeProductsCount
        ? {
          behavior: 'block',
          reason: 'Only Free Products Available In Cart',
          errors: [
            {
              // In addition, show an error at the page level
              message:
                'Only Free Products Available In Cart',
            },
          ],
        }
        : {
          behavior: 'allow',
        };
    },
  );

  useEffect(() => {
    (async () => {
      const curatedLinesData = await Promise.all(lines.map(async (line) => {
        const { data: { product } } = await fetchProduct(line.merchandise.product.id);
        if (!product) return {};
        const curatedCollection = product?.collections?.nodes?.map(item => item.id);
        const tags = product?.tags;
        return { tags, collections: curatedCollection, ...line };
      }))
      setLineItemsData(curatedLinesData)
    })()
  }, [lines]);

  useEffect(() => {
    if(rebuyTiers) {   
       lineItemsData.forEach(async (line) => {
        for(const attr of  line.attributes) {
          if (attr.key == '_attribution' && attr.value == 'Rebuy Tiered Progress Bar') {
            const id = line.merchandise.id;
            console.log(id, "variant Id");
            const staticId = id.split('gid://shopify/ProductVariant/')[1];
            console.log(rebuyTiers, "rebuyTiers");
            console.log(staticId, "static id");
            console.log(totalPrice, "totalPrice");
            console.log(rebuyTiers[staticId], "rebuy tier matched");
            if(totalPrice < rebuyTiers[staticId]) {
              await removeCartItem(line);
            }
          }
        }
    })
  }
  }, [rebuyTiers,lineItemsData])


  useEffect(() => {
    if (lineItemsData.length > 0) {
      let freeProductsCount = 0;
      let doesComplimentaryProductExist = false; //for complimentary product
      lineItemsData.forEach(async (line) => {
        let isComplimentaryProduct = false;
        const _rebuyTierSettings = line.attributes?.find(attr => attr.key == "_rebuyTierSettings");
        if(_rebuyTierSettings) {
          const _rebuyTiers = JSON.parse(_rebuyTierSettings.value);
          if(!rebuyTiers && Object.keys(_rebuyTiers).length) {
            setRebuyTiers(_rebuyTiers);
          }
        }
        let isFreeProduct = false; 
        doesComplimentaryProductExist = false;
        line?.attributes?.forEach(attr => {
          if (attr.key == '_attribution' && attr.value == 'Rebuy Tiered Progress Bar') {
            isFreeProduct = true;
              freeProductsCount = freeProductsCount + 1;
          }
          if (attr.key == "_complimentaryProduct" && attr.value == "true") {
            isComplimentaryProduct = true;
            doesComplimentaryProductExist = true;
            freeProductsCount = freeProductsCount + 1;
          }
        });
        isFreeProduct && line.quantity >= 2 && await updateCart(line);
        updateFreeProductsCount(freeProductsCount);

        const { tags = [] } = line || {};
        if (!isFreeProduct && tags.find(item => item == 'free_gift')) {
          const data = await removeCartItem(line);
          if (data.type == "error") {
            setTimeout(async () => {
              await removeCartItem(line);
            }, 1000)
          }
        }
        if (!removedComplimentaryProducts) {
          if (isComplimentaryProduct) {
            const data = await removeCartItem(line);
            if (data.type == "error") {
              setTimeout(async () => {
                await removeCartItem(line);
              }, 1000)
            }
          }
        }
      })
      if (!doesComplimentaryProductExist) {
        updateComplimentaryProductFlag(true);
      }
    }
  }, [lineItemsData])

  //remove existing complimentary product and re-add them
  useEffect(() => {
    let productAdded = [];
    if (removedComplimentaryProducts) {
      (async () => {
        const { data: { page: { complimentarySettings: { value: metaObjectData } } } } = await fetchPage();
        const metaObjectJson = JSON.parse(metaObjectData);
        const complimentarySettings = await Promise.all(metaObjectJson.map(async (metaobject) => {
          return await fetchMetaobject(metaobject)
        }));
        const curatedData = complimentarySettings.map(setting => {
          const collection = setting?.data?.metaobject?.collection.value;
          const variant = setting?.data?.metaobject?.variant.value;
          return {
            collection,
            variant
          }
        })
        console.log(curatedData, "curatedData")
        if (curatedData.length > 0) {
          lineItemsData.map((line) => {
            const collectionList = line?.collections || [];
            collectionList.map(async (collection) => {
              let isFreeProductElible = false;
              isFreeProductElible = curatedData.find(setting => {
                if (setting.collection == collection) {
                  return setting;
                }
              });
       
              if (isFreeProductElible) {
                const variantToAdd = isFreeProductElible.variant;
                if (productAdded.find(id => id == variantToAdd)) {
                  return;
                }
                else {
                  productAdded = [...productAdded, variantToAdd];
                  await handleAddToCart(variantToAdd);
                }
              }
            })
          });
        }
      })();
    };
  }, [removedComplimentaryProducts])

  useEffect(() => {
    if (showError) {
      const timer = setTimeout(() => setShowError(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showError]);

  async function updateCart(line) {
    const updateQuantity = await applyCartLinesChange({
      type: 'updateCartLine',
      id: `${line.id}`,
      merchandiseId: `${line.merchandise.id}`,
      quantity: 1,
    });
  }
  async function removeCartItem(line) {
    const removeItem = await applyCartLinesChange({
      type: 'removeCartLine',
      id: `${line.id}`,
      quantity: line.quantity
    })
    return removeItem;
  }
  async function handleAddToCart(constiantId) {
    setAdding(true);
    const result = await applyCartLinesChange({
      type: 'addCartLine',
      merchandiseId: constiantId,
      quantity: 1,
      attributes: [
        {
          "key": "_complimentaryProduct",
          "value": "true"
        }
      ]
    });
    setAdding(false);
    if (result.type == "error") {
      setTimeout(async () => {
        await handleAddToCart(constiantId);
      }, 2000)
    }
    else {
      return result;
    }
  }

  if (adding) {
    return (
      <Banner
        status="critical"
        title="Updating the offers."
      />
    )
  }
}