import { AIService } from "../../ai/services/ai.service";
import { QdrantService } from "../../qdrant/services/qdrant.service";

export class KnowledgeService {
  static async ingestCatalogItem(item: any): Promise<void> {
    await QdrantService.createCollection();

    const content = [
      `name: ${item.name}`,
      `type: ${item.type}`,
      `description: ${item.description || ""}`,
      `price: ${item.price}`,
      `discountAmount: ${item.discountAmount || 0}`,
      `durationMinutes: ${item.durationMinutes || 0}`,
      `id: ${item.id}`,
    ].join("\n");

    const vector = await AIService.generateEmbedding(content);
    await QdrantService.upsertVector({
      id: item.id,
      vector,
      payload: {
        businessId: String(item.businessId),
        catalogItemId: String(item.id),
        type: item.type,
        content,
      },
    });
  }

  static async deleteVectorsByCatalogItem(catalogItemId: string): Promise<void> {
    await QdrantService.deleteVectorsByCatalogItem(catalogItemId);
  }

  static async deleteVectorsByBusiness(businessId: string): Promise<void> {
    await QdrantService.deleteVectorsByBusiness(businessId);
  }
}
