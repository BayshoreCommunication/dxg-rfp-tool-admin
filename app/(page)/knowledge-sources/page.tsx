import KnowledgeSourcesPage from "@/components/knowledge/KnowledgeSourcesPage";
import KnowledgeReviewWorkspace from "@/components/knowledge/KnowledgeReviewWorkspace";
import { notFound } from "next/navigation";
export default function Page(){if(process.env.NEXT_PUBLIC_KNOWLEDGE_IMPORTS_ENABLED!=="true")notFound();return <><KnowledgeSourcesPage/><KnowledgeReviewWorkspace/></>;}
