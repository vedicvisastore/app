/**
 * Every editable piece of English copy on the storefront, with its default.
 * Admins override any of these in Admin → Content; overrides are saved as one JSON file in R2
 * (see src/server/site-config.ts) and merged over these defaults. Words in {braces} are filled in
 * by the site (prices, counts, dates) and must be kept.
 */
export const CONTENT_GROUPS = [
  {
    key: "nav",
    label: "Header and menu",
    fields: {
      boxes: { label: "Menu: boxes", value: "Bhakti Boxes" },
      japa: { label: "Menu: japa", value: "Japa" },
      shringar: { label: "Menu: shringar", value: "Shringar" },
      shopAll: { label: "Menu: shop all", value: "Shop all" },
      shop: { label: "Menu: shop", value: "Shop" },
      newLaunches: { label: "Menu: new launches", value: "New launches" },
      deals: { label: "Menu: deals", value: "Deals" },
      track: { label: "Menu: track order", value: "Track order" },
      kits: { label: "Menu: kits", value: "Kits & sets" },
      items: { label: "Menu: single items (malas, tilak, itra…)", value: "Malas & essentials" },
      about: { label: "Menu: about", value: "About us" },
      help: { label: "Menu: help", value: "Help" },
      orders: { label: "Menu: your orders", value: "Your orders" },
      contact: { label: "Menu: contact", value: "Contact & support" },
      shipping: { label: "Menu: shipping", value: "Shipping & returns" },
      byType: { label: "Shop menu: types title", value: "Shop by set" },
      byCategory: { label: "Shop menu: categories title", value: "Shop by category" },
      festivalsTitle: { label: "Mobile menu: custom pages title", value: "Specials" },
      searchPlaceholder: { label: "Search box hint", value: "Search malas, tilak, Bhakti Boxes…" },
    },
  },
  {
    key: "home",
    label: "Home page",
    fields: {
      heroTitle: { label: "Hero headline", value: "Bhakti, beautifully boxed." },
      heroLede: { label: "Hero sentence", value: "Puja and japa essentials, hand-packed and sent to every Indian pincode." },
      heroPrimary: { label: "Hero main button", value: "Shop Bhakti Boxes" },
      heroSecondary: { label: "Hero second button", value: "Shop all" },
      heroEverydayTitle: { label: "Opening hero headline", value: "Bhakti, for every day." },
      heroEverydayLede: { label: "Opening hero sentence", value: "Tulsi malas, tilak, itra and Bhakti Boxes for your daily rituals." },
      heroEverydayLabel: { label: "Opening hero label", value: "Daily rituals" },
      heroEverydayAction: { label: "Opening hero button", value: "Explore the collection" },
      heroJapaTitle: { label: "Japa hero headline", value: "A little time for japa." },
      heroJapaLede: { label: "Japa hero sentence", value: "Malas, bags and counters, brought together for your daily rounds." },
      heroShringarTitle: { label: "Shringar hero headline", value: "Devotion, in the details." },
      heroShringarLede: { label: "Shringar hero sentence", value: "Tilak, kanthi malas and itra for your everyday shringar." },
      heroShringarAction: { label: "Shringar hero button", value: "Shop shringar" },
      heroItemsLabel: { label: "Banner: single items label", value: "Malas & essentials" },
      heroItemsTitle: { label: "Banner: single items headline", value: "Everyday malas and puja essentials." },
      heroItemsAction: { label: "Banner: single items button", value: "Shop essentials" },
      heroSetsLabel: { label: "Banner: sets label", value: "Japa & shringar sets" },
      heroSetsTitle: { label: "Banner: sets headline", value: "A set for every practice." },
      heroSetsAction: { label: "Banner: sets button", value: "Shop sets" },
      categoriesTitle: { label: "Categories heading", value: "Shop by category" },
      categoriesLink: { label: "Categories link", value: "Everything" },
      heroEssentialsTile: { label: "Daily essentials hero tile", value: "Daily essentials from {price}" },
      heroSliderLabel: { label: "Hero slider description", value: "Explore daily rituals and collections" },
      heroSliderPrevious: { label: "Previous hero button", value: "Previous collection" },
      heroSliderNext: { label: "Next hero button", value: "Next collection" },
      heroSliderPause: { label: "Pause hero button", value: "Pause automatic sliding" },
      heroSliderPlay: { label: "Play hero button", value: "Resume automatic sliding" },
      chipShipping: { label: "Hero label 1", value: "India Post to every pincode" },
      chipDelivery: { label: "Hero label 2", value: "Delivered in {min}–{max} days", hint: "{min} {max} = delivery days from Settings" },
      chipFree: { label: "Hero label 3", value: "Free shipping above {threshold}", hint: "{threshold} = free shipping amount" },
      storyTile: { label: "Painting tile", value: "Our story" },
      japaTile: { label: "Japa tile", value: "Japa sets from {price}", hint: "{price} = cheapest japa set" },
      japaTileLink: { label: "Japa tile link", value: "Shop japa" },
      picksTitle: { label: "Top picks heading", value: "Bestsellers and offers" },
      picksBest: { label: "Top picks tab: bestsellers", value: "Bestsellers" },
      picksOffers: { label: "Top picks tab: on offer", value: "On offer" },
      picksNew: { label: "Top picks tab: new", value: "New in" },
      picksAll: { label: "Top picks link", value: "See all" },
      boxesTitle: { label: "Boxes heading", value: "Bhakti Boxes: puja and japa gift sets", hint: "Optional {count} = number of boxes. Put the words people search for (Bhakti Box, puja, japa, gift) first." },
      boxesLede: { label: "Boxes line", value: "Each box brings a Tulsi japa mala, tilak, itra and Krishna keepsakes for daily bhakti, hand-packed as one gift and delivered across India." },
      insideTitle: { label: "Inside heading", value: "Inside the {name} box", hint: "{name} = box name" },
      insideWorth: { label: "Inside value line", value: "Bought one by one, these come to {worth}. The box is {price}." },
      insideCta: { label: "Inside button", value: "Open the box" },
      shlokaTranslation: { label: "Shloka translation", value: "That which holds us is dharma." },
      shlokaBody: { label: "Shloka line", value: "Our line, from the old definition of dharma. Small daily rituals are what hold a day together; we make them easy to begin." },
      essentialsTitle: { label: "Essentials heading", value: "Malas, tilak and itra, on their own" },
      essentialsTrendingTitle: { label: "Essentials heading (when trending)", value: "What devotees are buying" },
      essentialsLink: { label: "Essentials link", value: "All {count} products" },
      setsTitle: { label: "Sets heading", value: "Smaller sets, one practice each" },
      setsJapaTab: { label: "Sets tab 1", value: "Japa sets" },
      setsJapaLine: { label: "Sets tab 1 line", value: "A mala, a bag to keep it in and a way to count your rounds." },
      setsShringarTab: { label: "Sets tab 2", value: "Shringar kits" },
      setsShringarLine: { label: "Sets tab 2 line", value: "Tilak, kanthi mala and itra for wearing your devotion every day." },
      followTitle: { label: "Social heading", value: "Daily darshan, on your feed" },
      followInstagram: { label: "Instagram card link", value: "Follow on Instagram" },
      followCreator: { label: "Creator card link", value: "Meet the creator" },
      followYoutubeTitle: { label: "YouTube card title", value: "VedicVisa on YouTube" },
      followYoutube: { label: "YouTube card link", value: "Watch and subscribe" },
    },
  },
  {
    key: "shop",
    label: "Shop page",
    fields: {
      allTitle: { label: "Title (all products)", value: "Shop all" },
      allBlurb: { label: "Line (all products)", value: "Every mala, kit and keepsake we make, most popular first." },
      boxesBlurb: { label: "Line (Bhakti Boxes)", value: "Complete daily-practice boxes, hand-packed and ready to gift." },
      japaBlurb: { label: "Line (Japa Sets)", value: "Mala, bag and counter: everything to chant your rounds." },
      shringarBlurb: { label: "Line (Shringar Kits)", value: "Tilak, kanthi mala and fragrance for every day." },
      itemsBlurb: { label: "Line (single items)", value: "Tulsi malas, tilak, itra and keepsakes, each sold on its own." },
      everything: { label: "Filter: everything", value: "Everything" },
      inStockOnly: { label: "In-stock switch", value: "In stock only" },
      emptyTitle: { label: "No results title", value: "Nothing matches that yet" },
      emptyBody: { label: "No results line", value: "Try a shorter search, or browse everything we have." },
      emptyCta: { label: "No results button", value: "Clear filters" },
    },
  },
  {
    key: "pages",
    label: "Deals, launches, tracking",
    fields: {
      dealsTitle: { label: "Deals: title", value: "Deals" },
      dealsLede: { label: "Deals: line", value: "Everything on offer right now, biggest savings first." },
      dealsOffersTitle: { label: "Deals: cart offers heading", value: "Applied at checkout, no code needed" },
      dealsEmpty: { label: "Deals: nothing on sale", value: "No deals running right now. Follow us on Instagram to hear about the next one first." },
      newTitle: { label: "New launches: title", value: "New launches" },
      newLede: { label: "New launches: line", value: "Fresh from the workshop, and what’s coming next." },
      newSoonTitle: { label: "New launches: coming soon heading", value: "Launching soon" },
      newJustTitle: { label: "New launches: newest heading", value: "Just arrived" },
      festivalOn: { label: "Custom page: date line", value: "{name} is on {date}", hint: "{name} {date} filled in" },
      festivalEmpty: { label: "Custom page: no products yet", value: "Products for this page are on their way. Check back soon." },
      trackTitle: { label: "Track: title", value: "Track your order" },
      trackLede: { label: "Track: line", value: "Enter your order number (it starts with VV-) and the email you ordered with." },
      trackCta: { label: "Track: button", value: "Track order" },
      trackSignedIn: { label: "Track: signed-in link", value: "See all your orders" },
      trackIndiaPost: { label: "Track: India Post link", value: "Track on India Post" },
      contactTitle: { label: "Contact: title", value: "Contact and support" },
      contactLede: { label: "Contact: line", value: "Questions about an order, a gift or a box? Write to us and a real person replies, usually within a day." },
      contactHours: { label: "Contact: hours", value: "Monday to Saturday, 10 am to 7 pm" },
      contactOrderTitle: { label: "Contact: order card title", value: "Where is my order?" },
      contactOrderBody: { label: "Contact: order card line", value: "Track it with your order number and email, no login needed." },
      contactDamageTitle: { label: "Contact: damage card title", value: "Something arrived damaged?" },
      contactDamageBody: { label: "Contact: damage card line", value: "Email us an unboxing photo within 48 hours with your order number and we’ll replace it." },
    },
  },
  {
    key: "product",
    label: "Product page",
    fields: {
      addToCart: { label: "Add button", value: "Add to cart" },
      buyNow: { label: "Buy now button", value: "Buy now" },
      inCart: { label: "Shown when this product is already in the cart", value: "{qty} in your cart" },
      viewCart: { label: "Open cart button (product already in cart)", value: "View cart" },
      soldOutTitle: { label: "Sold out title", value: "Sold out for now" },
      soldOutBody: { label: "Sold out line", value: "We restock every week. Check back soon or explore similar items below." },
      launchBody: { label: "Launching soon line", value: "This one isn’t on sale yet. We announce every launch on Instagram first." },
      launchCta: { label: "Launching soon button", value: "Follow @vedicvisastore for the launch" },
      freeShipping: { label: "Shipping line", value: "Free shipping on orders above {threshold}, otherwise {fee}.", hint: "{threshold} {fee} from Settings" },
      alwaysFree: { label: "Shipping line (always free)", value: "Free shipping on every order." },
      damaged: { label: "Damage promise", value: "Damaged in transit? Send us an unboxing photo within 48 hours and we’ll replace it." },
      aboutBox: { label: "About heading (boxes)", value: "About this box" },
      aboutProduct: { label: "About heading (products)", value: "About this product" },
      insideTitle: { label: "Contents heading", value: "What’s inside" },
      insideLede: { label: "Contents line", value: "Everything below comes packed together in one box." },
      relatedTitle: { label: "Related heading", value: "You may also like" },
      pincodePlaceholder: { label: "Pincode box hint", value: "Enter pincode for delivery date" },
    },
  },
  {
    key: "footer",
    label: "Footer",
    fields: {
      blurb: { label: "Footer line", value: "Puja and japa essentials, hand-packed and shipped across India by India Post." },
      shop: { label: "Column 1 title", value: "Shop" },
      help: { label: "Column 2 title", value: "Help" },
      follow: { label: "Column 3 title", value: "Follow and write to us" },
      byCategory: { label: "Categories title", value: "By category" },
    },
  },
  {
    key: "about",
    label: "Our story page",
    fields: {
      title: { label: "Title", value: "Devotion, made easy to begin" },
      p1: { label: "Paragraph 1", value: "VedicVisa started with a simple question from friends our age: where do I even start? Which mala, which tilak, what goes on the altar?" },
      p2: { label: "Paragraph 2", value: "So we put the answers in a box. Every Bhakti Box holds a complete daily practice, chosen with care and packed by hand, with nothing you won’t use." },
      p3: { label: "Paragraph 3", value: "We ship with India Post so a devotee in any pincode, from a metro flat to a village by the river, gets the same box." },
      cta: { label: "Button", value: "See the Bhakti Boxes" },
    },
  },
  {
    key: "cart",
    label: "Cart and checkout",
    fields: {
      emptyTitle: { label: "Empty cart title", value: "Your cart is empty" },
      emptyBody: { label: "Empty cart line", value: "Start with a Bhakti Box: everything for your daily practice, in one parcel." },
      emptyCta: { label: "Empty cart button", value: "Browse Bhakti Boxes" },
      checkout: { label: "Checkout button", value: "Checkout" },
      checkoutTitle: { label: "Checkout title", value: "Checkout" },
      addressTitle: { label: "Address heading", value: "Delivery address" },
      summaryTitle: { label: "Summary heading", value: "Order summary" },
      payNote: { label: "Payment note", value: "Pay with UPI, cards or netbanking." },
      placedTitle: { label: "Order placed title", value: "Thank you, your order is placed" },
    },
  },
  {
    key: "login",
    label: "Login",
    fields: {
      title: { label: "Title", value: "Log in" },
      lede: { label: "Line", value: "No password needed. New accounts are created automatically." },
      google: { label: "Google button", value: "Continue with Google" },
      emailCta: { label: "Email button", value: "Email me a code" },
      privacy: { label: "Note under the form", value: "We only email you about your orders. No spam, no password to remember." },
    },
  },
] as const satisfies readonly { key: string; label: string; fields: Record<string, { label: string; value: string; hint?: string }> }[];

type Groups = typeof CONTENT_GROUPS;
export type SiteContent = { [G in Groups[number] as G["key"]]: { [F in keyof G["fields"]]: string } };

export const DEFAULT_CONTENT = Object.fromEntries(
  CONTENT_GROUPS.map((g) => [g.key, Object.fromEntries(Object.entries(g.fields).map(([k, f]) => [k, f.value]))]),
) as SiteContent;

/** Flat key list ("home.heroTitle") for validating saved overrides. */
export const CONTENT_KEYS = new Set(CONTENT_GROUPS.flatMap((g) => Object.keys(g.fields).map((f) => `${g.key}.${f}`)));

export function mergeContent(overrides: Record<string, string> | undefined | null): SiteContent {
  const out = structuredClone(DEFAULT_CONTENT) as Record<string, Record<string, string>>;
  for (const [k, v] of Object.entries(overrides ?? {})) {
    if (!CONTENT_KEYS.has(k) || typeof v !== "string" || !v.trim()) continue;
    const [g, f] = k.split(".");
    out[g][f] = v;
  }
  return out as SiteContent;
}

/** Fills {placeholders}: fmt("{count} boxes", { count: 5 }) → "5 boxes". Unknown names stay as written. */
export function fmt(s: string, vars: Record<string, string | number>) {
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
