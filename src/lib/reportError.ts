import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { app, db } from "./firebase";
import { getSiteUrl } from "./sharing";
import type { User } from "./auth";

export type ReportCategory = "question" | "explanation" | "factual" | "technical";

export const REPORT_CATEGORIES: { value: ReportCategory; label: string }[] = [
  { value: "question", label: "Question error" },
  { value: "explanation", label: "Explanation error" },
  { value: "factual", label: "Factual error" },
  { value: "technical", label: "Technical error" },
];

const storage = getStorage(app);

export interface ReportInput {
  category: ReportCategory;
  description: string;
  image?: File | null;
  questionId?: string;
  user: User;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Uploads the optional image (if present) then writes the report doc.
 * Firestore is the source of truth; the Cloud Function trigger on this
 * collection handles the email notification separately.
 */
export async function submitReport(input: ReportInput): Promise<void> {
  const { category, description, image, questionId, user } = input;

  if (image && image.size > MAX_IMAGE_BYTES) {
    throw new Error("Image must be under 5MB.");
  }

  let imageUrl: string | null = null;
  if (image) {
    const safeName = image.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `bugReports/${user.uid}/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, image);
    imageUrl = await getDownloadURL(storageRef);
  }

  await addDoc(collection(db, "bugReports"), {
    category,
    description,
    imageUrl,
    questionId: questionId ?? null,
    questionUrl: questionId ? getSiteUrl(`/solve/${questionId}`) : null,
    userId: user.uid,
    userEmail: user.email ?? null,
    userDisplayName: user.displayName ?? null,
    status: "open",
    createdAt: serverTimestamp(),
  });
}

