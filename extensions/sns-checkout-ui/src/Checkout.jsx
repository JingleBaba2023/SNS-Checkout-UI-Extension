import React, { useEffect, useState } from "react";
import {
  reactExtension,
  Divider,
  Image,
  Banner,
  Heading,
  Button,
  InlineLayout,
  BlockStack,
  Text,
  SkeletonText,
  SkeletonImage,
  useCartLines,
  useApplyCartLinesChange,
  useBuyerJourneyIntercept,
  useApi
} from "@shopify/ui-extensions-react/checkout";

// Set up the entry point for the extension
export default reactExtension("purchase.checkout.block.render", () => <App />);

function App() {
  const { query, i18n } = useApi();
  const applyCartLinesChange = useApplyCartLinesChange();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showError, setShowError] = useState(false);
  const [freeProductsCount, updateFreeProductsCount] = useState(0);
  const lines = useCartLines();
  // const { amount: totalCost } = useSubtotalAmount();

  const fetchProduct = async (id) => {
    const headers = new Headers();
    headers.append("X-Shopify-Storefront-Access-Token", "d199d7b1934bb49ef55c92ffd695421d");
    headers.append("Content-Type", "application/json");
    const query = "query product ($id: ID) { product(id: $id) { title tags }}"
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

    const productData = await fetch("https://umesh-dev-store.myshopify.com/api/2023-10/graphql.json", requestOptions);
    const productJson = await productData.json();
    return productJson;
  }

  useBuyerJourneyIntercept(
    ({ canBlockProgress }) => {
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
    lines.map(line => {
      let isFreeProduct = false;
      line.attributes.forEach(attr => {
        if (attr.key == '_attribution' && attr.value == 'Rebuy Tiered Progress Bar') {
          isFreeProduct = true;
        }
      });
      isFreeProduct && line.quantity >= 2 && updateCart(line);
      isFreeProduct && updateFreeProductsCount(freeProductsCount + 1);
       
      (async () => {
       const {data:{product:{tags}}} =  await fetchProduct(line.merchandise.product.id);
       if(!isFreeProduct && tags.find(item => item == 'free_gift')){
        await removeCartItem(line);
       }
      })();
    })
  }, [lines]);

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
    if (updateQuantity.type === 'error') {
      setShowError(true);
      console.error(updateQuantity.message);
    }
  }
  async function removeCartItem(line) {
    const removeItem = await applyCartLinesChange({
      type: 'removeCartLine',
      id: `${line.id}`,
      quantity: line.quantity
    })
    if (removeItem.type === 'error') {
      setShowError(true);
      console.error(removeItem.message);
    }
  }

  async function handleAddToCart(constiantId) {
    setAdding(true);
    const result = await applyCartLinesChange({
      type: 'addCartLine',
      merchandiseId: constiantId,
      quantity: 1,
    });
    setAdding(false);
    if (result.type === 'error') {
      setShowError(true);
      console.error(result.message);
    }
  }

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!loading && products.length === 0) {
    return null;
  }

  const productsOnOffer = getProductsOnOffer(lines, products);

  if (!productsOnOffer.length) {
    return null;
  }

  <Extension lines={lines} />
  return (
    <ProductOffer
      product={productsOnOffer[0]}
      i18n={i18n}
      adding={adding}
      handleAddToCart={handleAddToCart}
      showError={showError}
    />
  );
}

function Extension({ lines }) {
  const address = useShippingAddress();
  useBuyerJourneyIntercept(
    ({ canBlockProgress }) => {
      return canBlockProgress &&
        address?.countryCode &&
        address.countryCode !== 'CA'
        ? {
          behavior: 'block',
          reason: 'Invalid shipping country',
          errors: [
            {
              message:
                'Sorry, we can only ship to Canada',
              // Show an error underneath the country code field
              target:
                '$.cart.deliveryGroups[0].deliveryAddress.countryCode',
            },
            {
              // In addition, show an error at the page level
              message:
                'Please use a different address.',
            },
          ],
        }
        : {
          behavior: 'allow',
        };
    },
  );

  return null;
}

function LoadingSkeleton() {
  return (
    <BlockStack spacing='loose'>
      <Divider />
      <Heading level={2}>You might also like</Heading>
      <BlockStack spacing='loose'>
        <InlineLayout
          spacing='base'
          columns={[64, 'fill', 'auto']}
          blockAlignment='center'
        >
          <SkeletonImage aspectRatio={1} />
          <BlockStack spacing='none'>
            <SkeletonText inlineSize='large' />
            <SkeletonText inlineSize='small' />
          </BlockStack>
          <Button kind='secondary' disabled={true}>
            Add
          </Button>
        </InlineLayout>
      </BlockStack>
    </BlockStack>
  );
}

function getProductsOnOffer(lines, products) {
  const cartLineProductconstiantIds = lines.map((item) => item.merchandise.id);
  return products.filter((product) => {
    const isProductconstiantInCart = product.constiants.nodes.some(({ id }) =>
      cartLineProductconstiantIds.includes(id)
    );
    return !isProductconstiantInCart;
  });
}

function ProductOffer({ product, i18n, adding, handleAddToCart, showError }) {
  const { images, title, constiants } = product;
  const renderPrice = i18n.formatCurrency(constiants.nodes[0].price.amount);
  const imageUrl =
    images.nodes[0]?.url ??
    'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_medium.png?format=webp&v=1530129081';

  return (
    <BlockStack spacing='loose'>
      <Divider />
      <Heading level={2}>You might also like</Heading>
      <BlockStack spacing='loose'>
        <InlineLayout
          spacing='base'
          columns={[64, 'fill', 'auto']}
          blockAlignment='center'
        >
          <Image
            border='base'
            borderWidth='base'
            borderRadius='loose'
            source={imageUrl}
            description={title}
            aspectRatio={1}
          />
          <BlockStack spacing='none'>
            <Text size='medium' emphasis='strong'>
              {title}
            </Text>
            <Text appearance='subdued'>{renderPrice}</Text>
          </BlockStack>
          <Button
            kind='secondary'
            loading={adding}
            accessibilityLabel={`Add ${title} to cart`}
            onPress={() => handleAddToCart(constiants.nodes[0].id)}
          >
            Add
          </Button>
        </InlineLayout>
      </BlockStack>
      {showError && <ErrorBanner />}
    </BlockStack>
  );
}



function ErrorBanner() {
  return (
    <Banner status='critical'>
      There was an issue adding this product. Please try again.
    </Banner>
  );
}
