import { listSites } from "./sites-store.js";
import {
  destroyCloudinaryAsset,
  isCloudinaryConfigured,
  offloadFormDataImages,
  uploadBuffer,
} from "../lib/cloudinary.js";
import {
  readBlob,
  writeBlob,
  readSitePackFile,
  writeSitePackFile,
  deleteSitePackFile,
} from "../db/blob-store.js";

const BLOB_KEY = "site-packs";

export const SITE_PACK_CATEGORIES = [
  "friday-pack-forms",
  "rams",
  "drawings",
  "installation-manuals",
  "training-certificates",
  "equipment-certificates",
  "general-uploads",
] as const;

export type SitePackCategory = (typeof SITE_PACK_CATEGORIES)[number];

export const SITE_PACK_CATEGORY_LABELS: Record<SitePackCategory, string> = {
  "friday-pack-forms": "Friday pack forms",
  rams: "RAMS",
  drawings: "Drawings",
  "installation-manuals": "Installation manuals",
  "training-certificates": "Training certificates",
  "equipment-certificates": "Equipment certificates",
  "general-uploads": "General uploads",
};

export type SitePackFolder = {
  id: string;
  siteId: string;
  category: SitePackCategory;
  name: string;
  createdAt: string;
};

export type SitePackDocument = {
  id: string;
  siteId: string;
  category: SitePackCategory;
  folderId?: string | null;
  name: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  source?: "upload" | "filled-form";
  templateId?: string;
  templateName?: string;
  kind?: string;
  formData?: Record<string, string>;
  documentNo?: string;
  code?: string;
  approvedBy?: string;
  /** Cloudinary secure URL when file is stored in Cloudinary. */
  fileUrl?: string;
  cloudinaryPublicId?: string;
  cloudinaryResourceType?: string;
};

type SitePacksStore = {
  folders: SitePackFolder[];
  documents: SitePackDocument[];
};

const MAX_FILE_BYTES = 4_000_000;

function isCategory(value: string): value is SitePackCategory {
  return (SITE_PACK_CATEGORIES as readonly string[]).includes(value);
}

function nextId(prefix: string, existing: string[]) {
  const nextNum =
    existing.reduce((max, id) => {
      const n = Number(id.replace(/\D/g, ""));
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0) + 1;
  return `${prefix}-${String(nextNum).padStart(4, "0")}`;
}

function normalizeDocument(raw: Partial<SitePackDocument> & { id: string; siteId: string; name: string }): SitePackDocument | null {
  if (!isCategory(String(raw.category))) return null;
  return {
    id: raw.id,
    siteId: raw.siteId,
    category: raw.category as SitePackCategory,
    folderId: raw.folderId ?? null,
    name: raw.name,
    mimeType: raw.mimeType || "application/octet-stream",
    size: Number.isFinite(raw.size) ? Number(raw.size) : 0,
    uploadedAt: raw.uploadedAt || new Date().toISOString(),
    source: raw.source === "filled-form" ? "filled-form" : "upload",
    templateId: raw.templateId,
    templateName: raw.templateName,
    kind: raw.kind,
    formData:
      raw.formData && typeof raw.formData === "object" && !Array.isArray(raw.formData)
        ? Object.fromEntries(
            Object.entries(raw.formData).map(([k, v]) => [k, String(v ?? "")]),
          )
        : undefined,
    documentNo: raw.documentNo,
    code: raw.code,
    approvedBy: raw.approvedBy,
    fileUrl: typeof raw.fileUrl === "string" ? raw.fileUrl : undefined,
    cloudinaryPublicId:
      typeof raw.cloudinaryPublicId === "string" ? raw.cloudinaryPublicId : undefined,
    cloudinaryResourceType:
      typeof raw.cloudinaryResourceType === "string"
        ? raw.cloudinaryResourceType
        : undefined,
  };
}

async function readStore(): Promise<SitePacksStore> {
  const raw = await readBlob<Partial<SitePacksStore>>(BLOB_KEY, {
    folders: [],
    documents: [],
  });
  const documents = Array.isArray(raw.documents)
    ? raw.documents
        .map((d) =>
          d?.id && d?.siteId && d?.name
            ? normalizeDocument(d as SitePackDocument)
            : null,
        )
        .filter((d): d is SitePackDocument => Boolean(d))
    : [];
  const folders = Array.isArray(raw.folders)
    ? raw.folders.filter(
        (f): f is SitePackFolder =>
          Boolean(f?.id && f?.siteId && f?.name && isCategory(String(f.category))),
      )
    : [];
  return { folders, documents };
}

async function writeStore(store: SitePacksStore) {
  await writeBlob(BLOB_KEY, store);
}

export function listSitePackCategories() {
  return SITE_PACK_CATEGORIES.map((id) => ({
    id,
    label: SITE_PACK_CATEGORY_LABELS[id],
  }));
}

export async function listSitePackDocuments(siteId: string): Promise<SitePackDocument[]> {
  return (await readStore()).documents
    .filter((d) => d.siteId === siteId)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function listSitePackFolders(
  siteId: string,
  category?: SitePackCategory,
): Promise<SitePackFolder[]> {
  return (await readStore()).folders
    .filter((f) => f.siteId === siteId && (!category || f.category === category))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function countSitePackDocuments(siteId: string): Promise<number> {
  return (await readStore()).documents.filter((d) => d.siteId === siteId).length;
}

export async function getSitePackSummary(siteId: string) {
  const documents = await listSitePackDocuments(siteId);
  const folders = await listSitePackFolders(siteId);
  const categories = SITE_PACK_CATEGORIES.map((id) => {
    const items = documents.filter((d) => d.category === id);
    const folderCount = folders.filter((f) => f.category === id).length;
    return {
      id,
      label: SITE_PACK_CATEGORY_LABELS[id],
      count: items.length,
      folderCount,
    };
  });
  return {
    siteId,
    categories,
    folders,
    documents,
    total: documents.length,
  };
}

export type CreateFolderInput = {
  siteId: string;
  category: string;
  name: string;
};

export async function createSitePackFolder(input: CreateFolderInput): Promise<SitePackFolder> {
  const siteId = input.siteId.trim();
  const name = input.name.trim();
  const category = input.category.trim();

  if (!siteId) throw new Error("Site is required");
  if (!(await listSites()).some((s) => s.id === siteId)) throw new Error("Site not found");
  if (!isCategory(category)) throw new Error("Select a valid pack category");
  if (!name) throw new Error("Folder name is required");

  const store = await readStore();
  if (
    store.folders.some(
      (f) =>
        f.siteId === siteId &&
        f.category === category &&
        f.name.toLowerCase() === name.toLowerCase(),
    )
  ) {
    throw new Error("A folder with this name already exists");
  }

  const folder: SitePackFolder = {
    id: nextId(
      "SF",
      store.folders.map((f) => f.id),
    ),
    siteId,
    category,
    name: name.slice(0, 120),
    createdAt: new Date().toISOString(),
  };

  store.folders = [folder, ...store.folders];
  await writeStore(store);
  return folder;
}

export async function deleteSitePackFolder(siteId: string, folderId: string): Promise<boolean> {
  const store = await readStore();
  const idx = store.folders.findIndex((f) => f.id === folderId && f.siteId === siteId);
  if (idx < 0) return false;

  const docsInFolder = store.documents.filter(
    (d) => d.siteId === siteId && d.folderId === folderId,
  );
  for (const doc of docsInFolder) {
    await deleteSitePackFile(doc.id);
  }

  store.documents = store.documents.filter(
    (d) => !(d.siteId === siteId && d.folderId === folderId),
  );
  store.folders.splice(idx, 1);
  await writeStore(store);
  return true;
}

export type UploadSitePackInput = {
  siteId: string;
  category: string;
  name: string;
  mimeType?: string;
  dataUrl: string;
  folderId?: string | null;
};

export async function uploadSitePackDocument(input: UploadSitePackInput): Promise<SitePackDocument> {
  const siteId = input.siteId.trim();
  const name = input.name.trim();
  const category = input.category.trim();
  const dataUrl = input.dataUrl?.trim() ?? "";
  const folderId = input.folderId?.trim() || null;

  if (!siteId) throw new Error("Site is required");
  if (!(await listSites()).some((s) => s.id === siteId)) throw new Error("Site not found");
  if (!isCategory(category)) throw new Error("Select a valid pack category");
  if (!name) throw new Error("File name is required");
  if (!dataUrl.startsWith("data:")) throw new Error("Upload a valid file");

  const store = await readStore();
  if (folderId) {
    const folder = store.folders.find((f) => f.id === folderId && f.siteId === siteId);
    if (!folder) throw new Error("Folder not found");
    if (folder.category !== category) throw new Error("Folder category mismatch");
  }

  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("Upload a valid file");
  const meta = dataUrl.slice(0, comma);
  const base64 = dataUrl.slice(comma + 1);
  if (!meta.includes(";base64") || !base64) throw new Error("Upload a valid file");

  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) throw new Error("File is empty");
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error("File is too large (max 4MB)");
  }

  const mimeMatch = /^data:([^;]+);base64$/i.exec(meta);
  const mimeType =
    (input.mimeType?.trim() || mimeMatch?.[1] || "application/octet-stream").slice(0, 120);

  const doc: SitePackDocument = {
    id: nextId(
      "SP",
      store.documents.map((d) => d.id),
    ),
    siteId,
    category,
    folderId,
    name: name.slice(0, 200),
    mimeType,
    size: buffer.length,
    uploadedAt: new Date().toISOString(),
    source: "upload",
  };

  if (isCloudinaryConfigured()) {
    const uploaded = await uploadBuffer(buffer, {
      folder: `sheq-harmony/site-packs/${siteId}/${category}`,
      filename: name,
      resourceType: mimeType.startsWith("image/") ? "image" : "auto",
    });
    doc.fileUrl = uploaded.url;
    doc.cloudinaryPublicId = uploaded.publicId;
    doc.cloudinaryResourceType = uploaded.resourceType;
    doc.size = uploaded.bytes || buffer.length;
  } else {
    await writeSitePackFile(doc.id, buffer);
  }

  store.documents = [doc, ...store.documents];
  await writeStore(store);
  return doc;
}

export type SaveFilledFormInput = {
  siteId: string;
  folderId: string;
  templateId: string;
  templateName: string;
  kind?: string;
  title: string;
  formData?: Record<string, string>;
  documentNo?: string;
  code?: string;
  approvedBy?: string;
};

export async function saveFilledForm(input: SaveFilledFormInput): Promise<SitePackDocument> {
  const siteId = input.siteId.trim();
  const folderId = input.folderId.trim();
  const templateId = input.templateId.trim();
  const templateName = input.templateName.trim();
  const title = input.title.trim();
  const kind = input.kind?.trim() || "";
  let formData = Object.fromEntries(
    Object.entries(input.formData ?? {}).map(([k, v]) => [String(k), String(v ?? "")]),
  );

  if (!siteId) throw new Error("Site is required");
  if (!(await listSites()).some((s) => s.id === siteId)) throw new Error("Site not found");
  if (!folderId) throw new Error("Folder is required");
  if (!templateId) throw new Error("Template is required");
  if (!title) throw new Error("Form title is required");

  const store = await readStore();
  const folder = store.folders.find((f) => f.id === folderId && f.siteId === siteId);
  if (!folder) throw new Error("Folder not found");
  if (folder.category !== "friday-pack-forms") {
    throw new Error("Filled forms can only be saved in Friday pack folders");
  }

  // Push logos/signatures to Cloudinary so JSON stays small and downloads keep URLs.
  formData = await offloadFormDataImages(
    formData,
    `sheq-harmony/forms/${siteId}`,
  );

  const payload = JSON.stringify(
    {
      templateId,
      templateName,
      kind,
      title,
      formData,
      savedAt: new Date().toISOString(),
    },
    null,
    2,
  );
  const buffer = Buffer.from(payload, "utf8");

  const doc: SitePackDocument = {
    id: nextId(
      "SP",
      store.documents.map((d) => d.id),
    ),
    siteId,
    category: "friday-pack-forms",
    folderId,
    name: title.slice(0, 200),
    mimeType: "application/json",
    size: buffer.length,
    uploadedAt: new Date().toISOString(),
    source: "filled-form",
    templateId,
    templateName: templateName.slice(0, 200),
    kind,
    formData,
    documentNo: input.documentNo?.trim(),
    code: input.code?.trim(),
    approvedBy: input.approvedBy?.trim(),
  };

  await writeSitePackFile(doc.id, buffer);
  store.documents = [doc, ...store.documents];
  await writeStore(store);
  return doc;
}

export async function updateFilledForm(
  siteId: string,
  docId: string,
  input: { title?: string; formData?: Record<string, string> },
): Promise<SitePackDocument> {
  const store = await readStore();
  const idx = store.documents.findIndex(
    (d) => d.id === docId && d.siteId === siteId && d.source === "filled-form",
  );
  if (idx < 0) throw new Error("Filled form not found");

  const current = store.documents[idx];
  const title = (input.title ?? current.name).trim();
  if (!title) throw new Error("Form title is required");

  let formData = Object.fromEntries(
    Object.entries(input.formData ?? current.formData ?? {}).map(([k, v]) => [
      String(k),
      String(v ?? ""),
    ]),
  );
  formData = await offloadFormDataImages(formData, `sheq-harmony/forms/${siteId}`);

  const payload = JSON.stringify(
    {
      templateId: current.templateId,
      templateName: current.templateName,
      kind: current.kind,
      title,
      formData,
      savedAt: new Date().toISOString(),
    },
    null,
    2,
  );
  const buffer = Buffer.from(payload, "utf8");

  const updated: SitePackDocument = {
    ...current,
    name: title.slice(0, 200),
    formData,
    size: buffer.length,
    uploadedAt: new Date().toISOString(),
  };

  await writeSitePackFile(updated.id, buffer);
  store.documents[idx] = updated;
  await writeStore(store);
  return updated;
}

export async function getSitePackDocument(
  siteId: string,
  docId: string,
): Promise<SitePackDocument | undefined> {
  return (await readStore()).documents.find((d) => d.id === docId && d.siteId === siteId);
}

export async function getSitePackFile(
  siteId: string,
  docId: string,
): Promise<{ doc: SitePackDocument; buffer: Buffer; redirectUrl?: string } | null> {
  const doc = await getSitePackDocument(siteId, docId);
  if (!doc) return null;
  if (doc.source === "filled-form" && doc.formData) {
    const buffer = Buffer.from(
      JSON.stringify(
        {
          templateId: doc.templateId,
          templateName: doc.templateName,
          kind: doc.kind,
          title: doc.name,
          formData: doc.formData,
        },
        null,
        2,
      ),
      "utf8",
    );
    return { doc, buffer };
  }
  if (doc.fileUrl) {
    return { doc, buffer: Buffer.alloc(0), redirectUrl: doc.fileUrl };
  }
  const buffer = await readSitePackFile(doc.id);
  if (!buffer) return null;
  return { doc, buffer };
}

export async function deleteSitePackDocument(siteId: string, docId: string): Promise<boolean> {
  const store = await readStore();
  const idx = store.documents.findIndex((d) => d.id === docId && d.siteId === siteId);
  if (idx < 0) return false;

  const removed = store.documents[idx]!;
  store.documents.splice(idx, 1);
  await writeStore(store);
  if (removed.cloudinaryPublicId) {
    await destroyCloudinaryAsset(
      removed.cloudinaryPublicId,
      (removed.cloudinaryResourceType as "image" | "raw" | "video" | "auto") || "auto",
    );
  } else {
    await deleteSitePackFile(docId);
  }
  return true;
}

export async function deleteAllPacksForSite(siteId: string): Promise<void> {
  const store = await readStore();
  const removedDocs = store.documents.filter((d) => d.siteId === siteId);
  store.documents = store.documents.filter((d) => d.siteId !== siteId);
  store.folders = store.folders.filter((f) => f.siteId !== siteId);
  await writeStore(store);
  for (const doc of removedDocs) {
    if (doc.cloudinaryPublicId) {
      await destroyCloudinaryAsset(
        doc.cloudinaryPublicId,
        (doc.cloudinaryResourceType as "image" | "raw" | "video" | "auto") || "auto",
      );
    } else {
      await deleteSitePackFile(doc.id);
    }
  }
}
