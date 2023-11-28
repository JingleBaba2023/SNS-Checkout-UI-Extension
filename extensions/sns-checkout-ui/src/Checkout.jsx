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
  const [freeProductsCount , updateFreeProductsCount] = useState(0);
  const lines = useCartLines();


  useBuyerJourneyIntercept(
    ({canBlockProgress}) => {
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
        if(attr.key == '_attribution' && attr.value == 'Rebuy Tiered Progress Bar'){
          isFreeProduct = true;
        }
      });
        isFreeProduct && line.quantity >= 2 && updateCart(line);
        isFreeProduct && updateFreeProductsCount(freeProductsCount + 1);
      })
  }, [lines]);



  useEffect(() => {
    if (showError) {
      const timer = setTimeout(() => setShowError(false), 3000);
      return () => clearTimeout(timer);
    }

  }, [showError]);

  async function updateCart(line){
      var updateQuantity = await applyCartLinesChange({
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
  // async function removeCartItem(line){
  //     const removeItem = await applyCartLinesChange({
  //       type: 'removeCartLine',
  //       id: `${line.id}`,
  //       quantity: line.quantity
  //     })
  //     if (removeItem.type === 'error') {
  //       setShowError(true);
  //       console.error(removeItem.message);
  //     }
  // }

  //   async function handleAddToCart(variantId) {
  //     setAdding(true);
  //     const result = await applyCartLinesChange({
  //       type: 'addCartLine',
  //       merchandiseId: variantId,
  //       quantity: 1,
  //     });
  //     setAdding(false);
  //     if (result.type === 'error') {
  //       setShowError(true);
  //       console.error(result.message);
  //     }
  //   }

  // async function fetchProducts() {
  //   setLoading(true);
  //   try {
  //     const { data } = await query(
  //       `query ($first: Int!) {
  //         products(first: $first) {
  //           nodes {
  //             id
  //             title
  //             images(first:1){
  //               nodes {
  //                 url
  //               }
  //             }
  //             variants(first: 1) {
  //               nodes {
  //                 id
  //                 price {
  //                   amount
  //                 }
  //               }
  //             }
  //           }
  //         }
  //       }`,
  //       {
  //         variables: { first: 5 },
  //       }
  //     );
  //     setProducts(data.products.nodes);
  //   } catch (error) {
  //     console.error(error);
  //   } finally {
  //     setLoading(false);
  //   }
  // }

  // if (loading) {
  //   return <LoadingSkeleton />;
  // }

  // if (!loading && products.length === 0) {
  //   return null;
  // }

  // const productsOnOffer = getProductsOnOffer(lines, products);

  // if (!productsOnOffer.length) {
  //   return null;
  // }

//   <Extension lines={lines}/>
//   return (
//     <ProductOffer
//       product={productsOnOffer[0]}
//       i18n={i18n}
//       adding={adding}
//       handleAddToCart={handleAddToCart}
//       showError={showError}
//     />
//   );
// }

// function Extension({ lines }) {
//   const address = useShippingAddress();
//   console.log(lines)
//   useBuyerJourneyIntercept(
//     ({canBlockProgress}) => {
//       return canBlockProgress &&
//         address?.countryCode &&
//         address.countryCode !== 'CA'
//         ? {
//             behavior: 'block',
//             reason: 'Invalid shipping country',
//             errors: [
//               {
//                 message:
//                   'Sorry, we can only ship to Canada',
//                 // Show an error underneath the country code field
//                 target:
//                   '$.cart.deliveryGroups[0].deliveryAddress.countryCode',
//               },
//               {
//                 // In addition, show an error at the page level
//                 message:
//                   'Please use a different address.',
//               },
//             ],
//           }
//         : {
//             behavior: 'allow',
//           };
//     },
//   );

//   return null;
// }

// function LoadingSkeleton() {
//   return (
//     <BlockStack spacing='loose'>
//       <Divider />
//       <Heading level={2}>You might also like</Heading>
//       <BlockStack spacing='loose'>
//         <InlineLayout
//           spacing='base'
//           columns={[64, 'fill', 'auto']}
//           blockAlignment='center'
//         >
//           <SkeletonImage aspectRatio={1} />
//           <BlockStack spacing='none'>
//             <SkeletonText inlineSize='large' />
//             <SkeletonText inlineSize='small' />
//           </BlockStack>
//           <Button kind='secondary' disabled={true}>
//             Add
//           </Button>
//         </InlineLayout>
//       </BlockStack>
//     </BlockStack>
//   );
// }

// function getProductsOnOffer(lines, products) {
//   const cartLineProductVariantIds = lines.map((item) => item.merchandise.id);
//   return products.filter((product) => {
//     const isProductVariantInCart = product.variants.nodes.some(({ id }) =>
//       cartLineProductVariantIds.includes(id)
//     );
//     return !isProductVariantInCart;
//   });
// }

// function ProductOffer({ product, i18n, adding, handleAddToCart, showError }) {
//   const { images, title, variants } = product;
//   const renderPrice = i18n.formatCurrency(variants.nodes[0].price.amount);
//   const imageUrl =
//     images.nodes[0]?.url ??
//     'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_medium.png?format=webp&v=1530129081';

//   return (
//     <BlockStack spacing='loose'>
//       <Divider />
//       <Heading level={2}>You might also like</Heading>
//       <BlockStack spacing='loose'>
//         <InlineLayout
//           spacing='base'
//           columns={[64, 'fill', 'auto']}
//           blockAlignment='center'
//         >
//           <Image
//             border='base'
//             borderWidth='base'
//             borderRadius='loose'
//             source={imageUrl}
//             description={title}
//             aspectRatio={1}
//           />
//           <BlockStack spacing='none'>
//             <Text size='medium' emphasis='strong'>
//               {title}
//             </Text>
//             <Text appearance='subdued'>{renderPrice}</Text>
//           </BlockStack>
//           <Button
//             kind='secondary'
//             loading={adding}
//             accessibilityLabel={`Add ${title} to cart`}
//             onPress={() => handleAddToCart(variants.nodes[0].id)}
//           >
//             Add
//           </Button>
//         </InlineLayout>
//       </BlockStack>
//       {showError && <ErrorBanner />}
//     </BlockStack>
//   );
// }

}

function ErrorBanner() {
  return (
    <Banner status='critical'>
      There was an issue adding this product. Please try again.
    </Banner>
  );
}
