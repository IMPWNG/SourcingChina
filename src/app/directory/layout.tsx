import { requireDirectory } from "@/lib/auth";

export default async function DirectoryLayout({ children }: { children: React.ReactNode }) {
  await requireDirectory();
  return children;
}
