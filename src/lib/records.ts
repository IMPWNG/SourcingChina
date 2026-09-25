import type { CompanyType, SubscriptionStatus, UserRole } from "@/lib/domain";

export type Category = { id: string; slug: string; name_en: string; name_zh: string | null };

export type Family = {
  id: string;
  company_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
};

export type Product = {
  id: string;
  company_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  source_url: string | null;
  details: Record<string, string>;
  created_at: string;
};

export type Certification = { id: string; company_id: string; code: string };
export type Factory = { id: string; company_id: string; name: string; address: string | null; city: string | null };
export type Contact = {
  id: string;
  company_id: string;
  name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  is_public: boolean;
};
export type Source = {
  id: string;
  company_id: string | null;
  source_type: "card" | "website" | "pdf";
  url_or_ref: string | null;
  raw_text: string | null;
  payload: Record<string, unknown>;
  captured_at: string;
};
export type ScrapeJob = {
  id: string;
  company_id: string;
  status: "proposed" | "applied" | "failed" | "skipped";
  proposed_patch: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
};

export type Company = {
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
  wechat_qr_url: string | null;
  phone: string | null;
  email: string | null;
  export_markets: string[];
  is_published: boolean;
  merged_into_id: string | null;
  last_scrape_status: string;
  last_scraped_at: string | null;
  created_at: string;
  updated_at: string;
  category_ids: string[];
};

export type CompanyDraft = {
  name_zh?: string | null;
  name_en?: string | null;
  brand?: string | null;
  company_type?: CompanyType;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  website?: string | null;
  wechat?: string | null;
  wechat_qr_url?: string | null;
  phone?: string | null;
  email?: string | null;
  export_markets?: string[];
  notes?: string | null;
  category_ids?: string[];
};

export type DirectoryFilters = {
  q?: string;
  category?: string;
  companyType?: string;
  province?: string;
  city?: string;
  hasEmail?: boolean;
  hasWebsite?: boolean;
};

export type SessionProfile = {
  id: string;
  email: string;
  role: UserRole;
  subscriptionStatus: SubscriptionStatus;
  currentPeriodEnd: string | null;
};

export type AdminCompany = Company & {
  notes: string | null;
  families: Family[];
  products: Product[];
  certifications: Certification[];
  factories: Factory[];
  contacts: Contact[];
  sources: Source[];
  scrape_jobs: ScrapeJob[];
};

export type DirectoryCompany = Company & {
  families: Family[];
  products: Product[];
  certifications: Certification[];
  factories: Factory[];
  contacts: Contact[];
};
