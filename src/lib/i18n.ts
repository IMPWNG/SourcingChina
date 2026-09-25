import { cookies } from "next/headers";

export type Locale = "en" | "fr";

const copy = {
  en: {
    pricing: "Pricing",
    directory: "Directory",
    admin: "Admin",
    account: "Account",
    signIn: "Sign in",
    signOut: "Sign out",
    createAccount: "Create account",
    openMenu: "Open menu",
    demo: "Demo mode. Supabase is not configured, so you are browsing sample suppliers stored on this machine.",
    footer: "SourcingChina — a reviewed directory of motorcycle-industry suppliers in China.",
    badge: "Motorcycle suppliers in China",
    hero: "Find the factory behind the business card.",
    heroBody:
      "SourcingChina is a paid directory of motorcycle-industry companies: factories, trading houses, and brands. Each record is taken from a card or a public website, then reviewed before it is published.",
    seeAccess: "See directory access",
    profileTitle: "What a profile contains",
    profile1: "Chinese and English names, kept separate. Brand, city, province, and whether the company builds, trades, or both.",
    profile2: "Company phone, email, WeChat, and website when they appear on the card or the company site.",
    profile3: "Product families — helmets, electrical, batteries — and the products found on the company site.",
    notMarket: "A directory, not a marketplace",
    noPrices: "No prices, stock, or SKU lists.",
    noStands: "No stand numbers, hall names, or visit dates.",
    noOutreach: "No outreach tools and no raw email dump.",
    unpublished: "Unpublished drafts stay invisible to subscribers.",
    how: "How a company gets in",
    step1: "1. A business card is read and the company is saved.",
    step2: "2. If the card has a website, that site is crawled for a products page.",
    step3: "3. An editor checks the draft and publishes it.",
    show: "The first batch comes from the Chongqing motorcycle trade show. The public site does not show the show itself.",
    families: "Product families in the taxonomy",
    suppliers: "Suppliers",
    published: "published",
    noMatch: "No suppliers match",
    noMatchBody: "Try another city or category. Unpublished drafts are hidden until an editor publishes them.",
    locationMissing: "Location not on file",
    disclaimer: "Data as collected from public materials; verify before business use.",
    demoAccess: "Demo access is active on this machine for 30 days. It is not an Airwallex payment.",
    back: "Back to search",
    brand: "Brand",
    company: "Company",
    addressMissing: "Address not on file.",
    phone: "Phone",
    email: "Email",
    wechat: "WeChat",
    website: "Website",
    notOnFile: "Not on file",
    samplePage: "Sample page used to demonstrate enrichment",
    markets: "Export markets",
    notStated: "Not stated",
    products: "Products",
    noProducts: "No products saved yet.",
    familiesTitle: "Product families",
    noFamilies: "No product families have been reviewed for this company yet.",
    certs: "Certifications named on file",
    factories: "Factory addresses",
    searchLabel: "Name, brand, or city",
    searchPlaceholder: "Helmets in Chongqing",
    category: "Category",
    anyCategory: "Any category",
    companyType: "Company type",
    anyType: "Any type",
    province: "Province",
    anyProvince: "Any province",
    city: "City",
    anyCity: "Any city",
    hasEmail: "Has an email",
    hasWebsite: "Has a website",
    search: "Search",
    clear: "Clear",
    filters: "Filters",
    filterSuppliers: "Filter suppliers",
    unnamed: "Unnamed supplier",
    lang: "Language",
  },
  fr: {
    pricing: "Tarifs",
    directory: "Annuaire",
    admin: "Admin",
    account: "Compte",
    signIn: "Connexion",
    signOut: "Déconnexion",
    createAccount: "Créer un compte",
    openMenu: "Ouvrir le menu",
    demo: "Mode démo. Supabase n’est pas configuré : vous voyez des fournisseurs d’exemple stockés sur cette machine.",
    footer: "SourcingChina — un annuaire relu de fournisseurs moto en Chine.",
    badge: "Fournisseurs moto en Chine",
    hero: "Retrouver l’usine derrière la carte de visite.",
    heroBody:
      "SourcingChina est un annuaire payant de sociétés de l’industrie moto : usines, sociétés de négoce et marques. Chaque fiche vient d’une carte ou d’un site public, puis est relue avant publication.",
    seeAccess: "Voir l’accès à l’annuaire",
    profileTitle: "Ce qu’une fiche contient",
    profile1: "Noms chinois et anglais, séparés. Marque, ville, province, et si la société fabrique, négocie, ou les deux.",
    profile2: "Téléphone, e-mail, WeChat et site, lorsqu’ils figurent sur la carte ou le site de la société.",
    profile3: "Familles de produits — casques, électrique, batteries — et les produits trouvés sur le site.",
    notMarket: "Un annuaire, pas une marketplace",
    noPrices: "Pas de prix, de stock, ni de listes de SKU.",
    noStands: "Pas de numéros de stand, de halls, ni de dates de visite.",
    noOutreach: "Pas d’outils de prospection, ni de dump d’e-mails.",
    unpublished: "Les brouillons non publiés restent invisibles pour les abonnés.",
    how: "Comment une société entre",
    step1: "1. Une carte de visite est lue et la société est enregistrée.",
    step2: "2. Si la carte a un site, ce site est crawlé pour trouver une page produits.",
    step3: "3. Un éditeur vérifie le brouillon et le publie.",
    show: "Le premier lot vient du salon moto de Chongqing. Le site public ne montre pas le salon lui-même.",
    families: "Familles de produits dans la taxonomie",
    suppliers: "Fournisseurs",
    published: "publiés",
    noMatch: "Aucun fournisseur",
    noMatchBody: "Essayez une autre ville ou catégorie. Les brouillons non publiés restent cachés.",
    locationMissing: "Lieu absent du dossier",
    disclaimer: "Données tirées de documents publics ; à vérifier avant usage commercial.",
    demoAccess: "L’accès démo est actif sur cette machine pour 30 jours. Ce n’est pas un paiement Airwallex.",
    back: "Retour à la recherche",
    brand: "Marque",
    company: "Société",
    addressMissing: "Adresse absente du dossier.",
    phone: "Téléphone",
    email: "E-mail",
    wechat: "WeChat",
    website: "Site",
    notOnFile: "Absent du dossier",
    samplePage: "Page d’exemple utilisée pour la démonstration",
    markets: "Marchés d’export",
    notStated: "Non indiqué",
    products: "Produits",
    noProducts: "Aucun produit enregistré.",
    familiesTitle: "Familles de produits",
    noFamilies: "Aucune famille de produits n’a encore été relue pour cette société.",
    certs: "Certifications indiquées",
    factories: "Adresses d’usine",
    searchLabel: "Nom, marque ou ville",
    searchPlaceholder: "Casques à Chongqing",
    category: "Catégorie",
    anyCategory: "Toutes les catégories",
    companyType: "Type de société",
    anyType: "Tous les types",
    province: "Province",
    anyProvince: "Toutes les provinces",
    city: "Ville",
    anyCity: "Toutes les villes",
    hasEmail: "A un e-mail",
    hasWebsite: "A un site",
    search: "Rechercher",
    clear: "Effacer",
    filters: "Filtres",
    filterSuppliers: "Filtrer les fournisseurs",
    unnamed: "Fournisseur sans nom",
    lang: "Langue",
  },
} as const;

const categories: Record<string, { en: string; fr: string }> = {
  helmets: { en: "Helmets", fr: "Casques" },
  "engine-parts": { en: "Engine parts", fr: "Pièces moteur" },
  batteries: { en: "Batteries", fr: "Batteries" },
  lighting: { en: "Lighting", fr: "Éclairage" },
  electrical: { en: "Electrical", fr: "Électrique" },
  accessories: { en: "Accessories", fr: "Accessoires" },
  apparel: { en: "Apparel", fr: "Vêtements" },
  "tires-wheels": { en: "Tires and wheels", fr: "Pneus et roues" },
  exhaust: { en: "Exhaust", fr: "Échappement" },
  "full-vehicles": { en: "Full vehicles", fr: "Véhicules complets" },
  other: { en: "Other", fr: "Autre" },
};

const companyTypes: Record<string, { en: string; fr: string }> = {
  factory: { en: "Factory", fr: "Usine" },
  trading: { en: "Trading company", fr: "Société de négoce" },
  mixed: { en: "Factory and trading", fr: "Usine et négoce" },
  unknown: { en: "Not classified", fr: "Non classé" },
};

export type Messages = { [K in keyof (typeof copy)["en"]]: string };

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  return jar.get("sc_lang")?.value === "fr" ? "fr" : "en";
}

export async function getMessages(): Promise<Messages> {
  const locale = await getLocale();
  return copy[locale];
}

export function categoryLabel(slug: string, locale: Locale, fallback: string): string {
  return categories[slug]?.[locale] ?? fallback;
}

export function companyTypeLabel(type: string, locale: Locale): string {
  return companyTypes[type]?.[locale] ?? type;
}

export function translated(details: Record<string, string>, key: "name" | "description" | "address" | "city", locale: Locale, fallback: string | null): string | null {
  const value = details[`${key}_${locale}`];
  return value || fallback;
}

export const HIDDEN_DETAIL_KEYS = new Set([
  "name_en",
  "name_fr",
  "description_en",
  "description_fr",
  "address_en",
  "address_fr",
  "city_en",
  "city_fr",
  "title_en",
  "title_fr",
]);
