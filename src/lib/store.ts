import "server-only";

import { isDemoMode } from "@/lib/env";
import { demoStore } from "@/lib/demo/store";
import { supabaseStore } from "@/lib/supabase/store";
import type { CompanyDraft, DirectoryFilters } from "@/lib/records";
import type { CardExtraction } from "@/lib/domain";

function store() {
  return isDemoMode() ? demoStore : supabaseStore;
}

export const directory = {
  listCategories: () => store().listCategories(),
  search: (filters: DirectoryFilters) => store().search(filters),
  getPublished: (id: string) => store().getPublished(id),
  adminList: (status: "all" | "draft" | "published") => store().adminList(status),
  adminGet: (id: string) => store().adminGet(id),
  counts: () => store().counts(),
  createCompany: (draft: CompanyDraft) => store().createCompany(draft),
  updateCompany: (id: string, draft: CompanyDraft) => store().updateCompany(id, draft),
  setPublished: (id: string, published: boolean) => store().setPublished(id, published),
  addCategory: (input: { slug: string; name_en: string; name_zh: string | null }) => store().addCategory(input),
  addFamily: (companyId: string, input: { name: string; description: string | null; category_id: string | null }) =>
    store().addFamily(companyId, input),
  deleteFamily: (id: string) => store().deleteFamily(id),
  addCert: (companyId: string, code: string) => store().addCert(companyId, code),
  deleteCert: (id: string) => store().deleteCert(id),
  addFactory: (companyId: string, input: { name: string; address: string | null; city: string | null }) =>
    store().addFactory(companyId, input),
  deleteFactory: (id: string) => store().deleteFactory(id),
  addContact: (
    companyId: string,
    input: { name: string; title: string | null; phone: string | null; email: string | null; is_public: boolean },
  ) => store().addContact(companyId, input),
  setContactPublic: (id: string, isPublic: boolean) => store().setContactPublic(id, isPublic),
  deleteContact: (id: string) => store().deleteContact(id),
  addSource: (input: {
    company_id: string | null;
    source_type: "card" | "website" | "pdf";
    url_or_ref: string | null;
    raw_text: string | null;
    payload: Record<string, unknown>;
  }) => store().addSource(input),
  saveScrapeJob: (input: {
    company_id: string;
    status: "proposed" | "applied" | "failed" | "skipped";
    proposed_patch: Record<string, unknown> | null;
    error: string | null;
  }) => store().saveScrapeJob(input),
  applyScrape: (jobId: string) => store().applyScrape(jobId),
  duplicates: () => store().duplicates(),
  merge: (primaryId: string, duplicateId: string) => store().merge(primaryId, duplicateId),
  createFromCard: (
    extraction: CardExtraction,
    source: { url_or_ref: string | null; raw_text: string; payload: Record<string, unknown> },
  ) => store().createFromCard(extraction, source),
};
