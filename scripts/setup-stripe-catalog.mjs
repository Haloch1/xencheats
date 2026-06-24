import "dotenv/config";
import Stripe from "stripe";
import { products } from "../data/products.js";

const stripeKey = process.env.STRIPE_SECRET_KEY;

if (!stripeKey || /replace_me/i.test(stripeKey)) {
  throw new Error("Add a real STRIPE_SECRET_KEY to .env before running this script.");
}

const stripe = new Stripe(stripeKey);

const catalog = products.flatMap((product) =>
  (product.variants || [])
    .filter((variant) => variant.amount > 0 && !String(variant.stripeEnvKey || "").startsWith("DISABLED_"))
    .map((variant) => ({
      slug: variant.inventorySlug || `${product.slug}-${variant.slug}`,
      name: `${product.name} - ${variant.name}`,
      description: product.summary,
      amount: variant.amount,
      envKey: variant.stripeEnvKey,
    }))
);

async function getOrCreateProduct(item) {
  const existing = await stripe.products.search({
    query: `metadata['slug']:'${item.slug}'`,
    limit: 1,
  });

  if (existing.data[0]) {
    return existing.data[0];
  }

  return stripe.products.create({
    name: item.name,
    description: item.description,
    metadata: {
      slug: item.slug,
      source: "halo-cheats-storefront",
    },
  });
}

async function getOrCreatePrice(item, product) {
  const prices = await stripe.prices.list({
    product: product.id,
    active: true,
    limit: 10,
  });

  const matchingPrice = prices.data.find(
    (price) =>
      price.type === "one_time" &&
      price.currency === "usd" &&
      price.unit_amount === item.amount
  );

  if (matchingPrice) {
    return matchingPrice;
  }

  return stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: item.amount,
    metadata: {
      slug: item.slug,
      source: "halo-cheats-storefront",
    },
  });
}

const result = [];

for (const item of catalog) {
  const product = await getOrCreateProduct(item);
  const price = await getOrCreatePrice(item, product);

  if (product.default_price !== price.id) {
    await stripe.products.update(product.id, {
      default_price: price.id,
    });
  }

  result.push({
    slug: item.slug,
    productId: product.id,
    priceId: price.id,
    envKey: item.envKey,
  });
}

console.log(JSON.stringify(result, null, 2));
