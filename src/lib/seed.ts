import type { CompanyType } from "@/lib/domain";

export const CATEGORIES = [
  { id: "a0000001-0000-4000-8000-000000000001", slug: "helmets", name_en: "Helmets", name_zh: "头盔" },
  { id: "a0000001-0000-4000-8000-000000000002", slug: "engine-parts", name_en: "Engine parts", name_zh: "发动机配件" },
  { id: "a0000001-0000-4000-8000-000000000003", slug: "batteries", name_en: "Batteries", name_zh: "电池" },
  { id: "a0000001-0000-4000-8000-000000000004", slug: "lighting", name_en: "Lighting", name_zh: "灯具" },
  { id: "a0000001-0000-4000-8000-000000000005", slug: "electrical", name_en: "Electrical", name_zh: "电气" },
  { id: "a0000001-0000-4000-8000-000000000006", slug: "accessories", name_en: "Accessories", name_zh: "配件" },
  { id: "a0000001-0000-4000-8000-000000000007", slug: "apparel", name_en: "Apparel", name_zh: "骑行服饰" },
  { id: "a0000001-0000-4000-8000-000000000008", slug: "tires-wheels", name_en: "Tires and wheels", name_zh: "轮胎轮毂" },
  { id: "a0000001-0000-4000-8000-000000000009", slug: "exhaust", name_en: "Exhaust", name_zh: "排气" },
  { id: "a0000001-0000-4000-8000-000000000010", slug: "full-vehicles", name_en: "Full vehicles", name_zh: "整车" },
  { id: "a0000001-0000-4000-8000-000000000011", slug: "other", name_en: "Other", name_zh: "其他" },
] as const;

export type SeedCompany = {
  id: string;
  name_zh: string | null;
  name_en: string | null;
  brand: string | null;
  company_type: CompanyType;
  address: string | null;
  city: string | null;
  province: string | null;
  country: string;
  website: string | null;
  wechat: string | null;
  phone: string | null;
  email: string | null;
  export_markets: string[];
  notes: string;
  is_published: boolean;
  categories: string[];
  families: { name: string; description: string; category: string | null }[];
  certifications: string[];
};

const SAMPLE_NOTE =
  "Sample record for an empty directory. Fictional supplier — not collected from a card. Replace it by publishing a reviewed card.";

export const SEED_COMPANIES: SeedCompany[] = [
  {
    id: "c0000001-0000-4000-8000-000000000001",
    name_zh: "庆岭顶点头盔有限公司",
    name_en: "Qingling Apex Helmets Co., Ltd.",
    brand: "ApexRide",
    company_type: "factory",
    address: "No. 18 Fengqi Road, Shapingba, Chongqing, China",
    city: "Chongqing",
    province: "Chongqing",
    country: "CN",
    website: "https://apexride.example",
    wechat: "ApexRideHelmets",
    phone: "+86 23 6500 2210",
    email: "sales@apexride.example",
    export_markets: ["EU", "US"],
    notes: SAMPLE_NOTE,
    is_published: true,
    categories: ["helmets"],
    families: [
      { name: "Full-face helmets", description: "Street and sport full-face shells.", category: "helmets" },
      { name: "Open-face helmets", description: "Scooter and cruiser open-face shells.", category: "helmets" },
    ],
    certifications: ["CCC", "ECE"],
  },
  {
    id: "c0000001-0000-4000-8000-000000000002",
    name_zh: "嘉陵江电气有限公司",
    name_en: "Jialing River Electrical Co., Ltd.",
    brand: "Jialing Electric",
    company_type: "factory",
    address: "No. 6 Jiangbei Avenue, Yuzhong, Chongqing, China",
    city: "Chongqing",
    province: "Chongqing",
    country: "CN",
    website: "https://jialing-electric.example",
    wechat: "JialingElectric",
    phone: "+86 23 6300 1180",
    email: "export@jialing-electric.example",
    export_markets: ["ASEAN", "EU"],
    notes: SAMPLE_NOTE,
    is_published: true,
    categories: ["electrical", "lighting"],
    families: [
      { name: "Stators and regulators", description: "Charging-system electrical assemblies.", category: "electrical" },
      { name: "Handlebar switch sets", description: "Left and right switch clusters.", category: "electrical" },
    ],
    certifications: ["ISO9001"],
  },
  {
    id: "c0000001-0000-4000-8000-000000000003",
    name_zh: "渝中电池科技有限公司",
    name_en: "Yuzhong Battery Technology Co., Ltd.",
    brand: "YuCell",
    company_type: "factory",
    address: "No. 9 Daxigou, Yuzhong, Chongqing, China",
    city: "Chongqing",
    province: "Chongqing",
    country: "CN",
    website: "https://yucell.example",
    wechat: "YuCellBattery",
    phone: "+86 23 6377 4401",
    email: "hello@yucell.example",
    export_markets: ["EU"],
    notes: SAMPLE_NOTE,
    is_published: true,
    categories: ["batteries"],
    families: [{ name: "12V motorcycle batteries", description: "AGM and gel batteries for starter circuits.", category: "batteries" }],
    certifications: ["CE"],
  },
  {
    id: "c0000001-0000-4000-8000-000000000004",
    name_zh: "南岸轮胎轮毂贸易",
    name_en: "Nan'an Tire and Wheel Trading",
    brand: null,
    company_type: "trading",
    address: "Nan'an District, Chongqing, China",
    city: "Chongqing",
    province: "Chongqing",
    country: "CN",
    website: "https://nanan-wheels.example",
    wechat: "NananWheels",
    phone: "+86 23 6288 9012",
    email: null,
    export_markets: [],
    notes: SAMPLE_NOTE,
    is_published: true,
    categories: ["tires-wheels"],
    families: [{ name: "Alloy wheels", description: "Cast wheels for underbone and scooter platforms.", category: "tires-wheels" }],
    certifications: [],
  },
  {
    id: "c0000001-0000-4000-8000-000000000005",
    name_zh: "北碚排气厂",
    name_en: "Beibei Exhaust Works",
    brand: "BeiPipe",
    company_type: "factory",
    address: "Beibei District, Chongqing, China",
    city: "Chongqing",
    province: "Chongqing",
    country: "CN",
    website: null,
    wechat: "BeiPipe",
    phone: "+86 23 6822 3344",
    email: "works@beipipe.example",
    export_markets: ["US"],
    notes: SAMPLE_NOTE,
    is_published: true,
    categories: ["exhaust"],
    families: [{ name: "Slip-on exhausts", description: "Replacement mufflers for small-displacement bikes.", category: "exhaust" }],
    certifications: ["E-mark"],
  },
  {
    id: "c0000001-0000-4000-8000-000000000006",
    name_zh: "两江骑行服饰",
    name_en: "Liangjiang Riding Apparel",
    brand: "Liangjiang",
    company_type: "factory",
    address: null,
    city: "Chongqing",
    province: "Chongqing",
    country: "CN",
    website: "fixture://sample-supplier",
    wechat: null,
    phone: null,
    email: null,
    export_markets: [],
    notes: "Sample enrichment target. Website is a local fixture, not a public supplier site. Scrape should fill phone, email, families, and certifications.",
    is_published: true,
    categories: ["apparel"],
    families: [],
    certifications: [],
  },
  {
    id: "c0000001-0000-4000-8000-000000000007",
    name_zh: "温州火花灯具有限公司",
    name_en: "Wenzhou Spark Lighting Co., Ltd.",
    brand: "SparkLight",
    company_type: "factory",
    address: "Ouhai District, Wenzhou, Zhejiang, China",
    city: "Wenzhou",
    province: "Zhejiang",
    country: "CN",
    website: "https://sparklight.example",
    wechat: "SparkLight",
    phone: "+86 577 8888 1234",
    email: "sales@sparklight.example",
    export_markets: ["EU", "ASEAN"],
    notes: SAMPLE_NOTE,
    is_published: true,
    categories: ["lighting"],
    families: [{ name: "LED headlamps", description: "Motorcycle headlamp assemblies.", category: "lighting" }],
    certifications: ["CE", "E-mark"],
  },
  {
    id: "c0000001-0000-4000-8000-000000000008",
    name_zh: "广州港湾配件贸易",
    name_en: "Guangzhou Harbor Parts Trading",
    brand: null,
    company_type: "trading",
    address: "Baiyun District, Guangzhou, Guangdong, China",
    city: "Guangzhou",
    province: "Guangdong",
    country: "CN",
    website: "https://harbor-parts.example",
    wechat: "HarborParts",
    phone: "+86 20 3600 7788",
    email: "trade@harbor-parts.example",
    export_markets: ["AFRICA", "EU"],
    notes: SAMPLE_NOTE,
    is_published: true,
    categories: ["engine-parts", "accessories"],
    families: [
      { name: "Piston kits", description: "Oversize and standard piston sets.", category: "engine-parts" },
      { name: "Levers and grips", description: "Rider contact parts.", category: "accessories" },
    ],
    certifications: [],
  },
  {
    id: "c0000001-0000-4000-8000-000000000009",
    name_zh: "沙坪坝未审卡片",
    name_en: "Shapingba Unreviewed Card",
    brand: null,
    company_type: "unknown",
    address: "Shapingba, Chongqing",
    city: "Chongqing",
    province: "Chongqing",
    country: "CN",
    website: null,
    wechat: null,
    phone: "+86 23 6000 0009",
    email: null,
    export_markets: [],
    notes: "Unpublished draft. Hidden from subscribers until an admin publishes it.",
    is_published: false,
    categories: ["other"],
    families: [],
    certifications: [],
  },
];

export const SAMPLE_CARD_TEXT = `重庆庆岭顶点头盔有限公司
QINGLING APEX HELMETS CO., LTD.
Brand: ApexRide
Add: No. 18 Fengqi Road, Shapingba, Chongqing, China
Tel: +86 23 6500 2210
Email: sales@apexride.example
Web: www.apexride.example?utm_source=card
WeChat: ApexRideHelmets
Export: EU, US
Factory
Contact: Li Wei, Export Manager, +86 13800002210`;

export const DEMO_SUBSCRIBER_EMAIL = "demo.subscriber@sourcingchina.example";
export const DEMO_SUBSCRIBER_PASSWORD = "demo-subscriber";
export const DEMO_ADMIN_EMAIL = "demo.admin@sourcingchina.example";
export const DEMO_ADMIN_PASSWORD = "demo-admin";
