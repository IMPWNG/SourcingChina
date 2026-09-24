import type { Metadata } from "next";
import { uploadCards } from "@/app/actions/admin";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SAMPLE_CARD_TEXT } from "@/lib/seed";
import { catalogNotice } from "@/lib/scrapegraph/catalog-message";

export const metadata: Metadata = { title: "Upload cards" };
export const maxDuration = 60;

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; warning?: string; catalog?: string; products?: string; ocr?: string }>;
}) {
  const params = await searchParams;
  const notice = catalogNotice(params.catalog, params.products);
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Upload business cards</h1>
      <p className="text-sm text-muted-foreground">
        Each photo becomes one unpublished company. The app reads the photo with Tesseract, in Chinese and English, then Mammouth turns that text into company fields. When the card has a website, that site is crawled for products at the same time. Without MAMMOUTH_API_KEY, the card still keeps the OCR text and the site is not crawled.
      </p>
      {params.error === "empty" ? (
        <Alert variant="destructive">
          <AlertDescription>Add at least one image or paste card text.</AlertDescription>
        </Alert>
      ) : null}
      {params.warning === "scrapegraph" ? (
        <Alert variant="destructive">
          <AlertDescription>
            Mammouth could not structure this card. The draft kept the OCR text.
          </AlertDescription>
        </Alert>
      ) : null}
      {notice ? (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}
      {params.ocr === "empty" ? (
        <Alert variant="destructive">
          <AlertDescription>This photo had no readable text. The draft was saved without card fields.</AlertDescription>
        </Alert>
      ) : null}
      {params.created ? (
        <Alert>
          <AlertDescription>{params.created} draft{params.created === "1" ? "" : "s"} created. They stay unpublished until you review them.</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Card batch</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={uploadCards} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cards">Images (jpg, png, webp, heic)</Label>
              <input id="cards" name="cards" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple className="block w-full text-sm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="raw_text">Card text</Label>
              <Textarea id="raw_text" name="raw_text" rows={10} placeholder="Optional. Paste card text if a photo cannot be read." defaultValue="" />
            </div>
            <SubmitButton pendingLabel="Reading cards…">Create drafts</SubmitButton>
          </form>
          <form action={uploadCards} className="mt-4">
            <input type="hidden" name="raw_text" value={SAMPLE_CARD_TEXT} />
            <SubmitButton variant="outline" pendingLabel="Creating sample…">
              Create draft from the sample card
            </SubmitButton>
          </form>
          <p className="mt-4 font-mono text-xs text-muted-foreground whitespace-pre-wrap">{SAMPLE_CARD_TEXT}</p>
        </CardContent>
      </Card>
    </main>
  );
}
