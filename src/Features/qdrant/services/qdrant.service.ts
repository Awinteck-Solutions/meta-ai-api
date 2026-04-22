import { QdrantClient } from "@qdrant/js-client-rest";
import { env } from "../../../config/env";
import { logger } from "../../../helpers/logger";

const COLLECTION_NAME = "business_knowledge";

export class QdrantService {
  private static client: QdrantClient | null = null;
  private static readonly MAX_QDRANT_INT_ID = 2147483647;
  private static readonly DEFAULT_VECTOR_SIZE = 1536;

  private static toQdrantPointId(id: string | number): number {
    if (typeof id === "number" && Number.isFinite(id)) {
      const normalized = Math.abs(Math.floor(id)) % this.MAX_QDRANT_INT_ID;
      return normalized === 0 ? 1 : normalized;
    }

    // Qdrant accepts numeric IDs or UUID strings. Mongo ObjectId strings are not UUIDs,
    // so we deterministically map them to a positive int ID.
    const digest = Buffer.from(String(id));
    let hash = 0;
    for (const byte of digest) {
      hash = (hash * 31 + byte) % this.MAX_QDRANT_INT_ID;
    }
    return hash === 0 ? 1 : hash;
  }

  static getClient() {
    if (!env.qdrantUrl) {
      logger.error("Qdrant URL is not set");
      return null;
    }
    if (!this.client) {
      this.client = new QdrantClient({
        url: env.qdrantUrl,
        apiKey: env.qdrantApiKey || undefined,
      });
    }
    return this.client;
  }

  static async createCollection(vectorSize = 1536): Promise<void> { 
    const client = this.getClient(); 
    if (!client) {
      return;
    }

    try {
      const collections = await client.getCollections();
      const exists = collections.collections.some((c) => c.name === COLLECTION_NAME);
      if (!exists) {
        logger.info("Creating...");
        await this.recreateCollection(vectorSize);
        return;
      }

      const info: any = await client.getCollection(COLLECTION_NAME);
      const configuredSize = this.extractCollectionVectorSize(info);
      if (configuredSize && configuredSize !== vectorSize) {
        logger.warn("Qdrant collection vector size mismatch; recreating collection", {
          configuredSize,
          requestedSize: vectorSize,
          collection: COLLECTION_NAME,
        });
        await this.recreateCollection(vectorSize);
        return;
      }

      await this.ensurePayloadIndexes();
    } catch (error) {
      logger.error("Qdrant createCollection failed", error);
    }
  }

  private static extractCollectionVectorSize(collectionInfo: any): number | null {
    const vectors = collectionInfo?.result?.config?.params?.vectors;
    if (!vectors) {
      return null;
    }

    if (typeof vectors?.size === "number") {
      return vectors.size;
    }

    // Named vectors format.
    if (typeof vectors === "object") {
      const firstVectorConfig = Object.values(vectors)[0] as any;
      if (firstVectorConfig && typeof firstVectorConfig.size === "number") {
        return firstVectorConfig.size;
      }
    }

    return null;
  }

  private static async recreateCollection(vectorSize: number): Promise<void> {
    const client = this.getClient();
    if (!client) {
      return;
    }

    try {
      await client.deleteCollection(COLLECTION_NAME);
    } catch (_error) {
      // Ignore if collection does not yet exist.
    }

    await client.createCollection(COLLECTION_NAME, {
      vectors: {
        size: vectorSize || this.DEFAULT_VECTOR_SIZE,
        distance: "Cosine",
      },
    });

    await this.ensurePayloadIndexes();
  }

  private static async ensurePayloadIndexes(): Promise<void> {
    const client = this.getClient();
    if (!client) {
      return;
    }

    const indexFields = ["businessId", "catalogItemId"];
    for (const fieldName of indexFields) {
      try {
        await client.createPayloadIndex(COLLECTION_NAME, {
          field_name: fieldName,
          field_schema: "keyword",
        });
      } catch (error) {
        // Ignore "already exists" style failures but keep visibility.
        logger.warn("Qdrant payload index ensure warning", {
          fieldName,
          error,
        });
      }
    }
  }

  static async upsertVector(params: {
    id: string | number;
    vector: number[];
    payload: Record<string, unknown>;
  }): Promise<void> {
    const client = this.getClient();
    if (!client) {
      return;
    }

    const vectorSize = params.vector.length || this.DEFAULT_VECTOR_SIZE;
    await this.createCollection(vectorSize);

    try {
      await client.upsert(COLLECTION_NAME, {
        points: [
          {
            id: this.toQdrantPointId(params.id),
            vector: params.vector,
            payload: params.payload,
          },
        ],
      });
    } catch (error) {
      const apiError = error as any;
      if (apiError?.status === 400) {
        logger.warn("Qdrant upsert returned 400; recreating collection and retrying once", {
          vectorSize,
          errorData: apiError?.data,
        });
        await this.recreateCollection(vectorSize);
        await client.upsert(COLLECTION_NAME, {
          points: [
            {
              id: this.toQdrantPointId(params.id),
              vector: params.vector,
              payload: params.payload,
            },
          ],
        });
        return;
      }
      logger.error("Qdrant upsert failed", {
        error,
        vectorSize: params.vector.length,
        payloadKeys: Object.keys(params.payload || {}),
      });
      throw error;
    }
  }

  static async searchVector(params: {
    businessId: string;
    vector: number[];
    limit?: number;
  }) {
    const client = this.getClient();
    if (!client) {
      return [];
    }

    const vectorSize = params.vector.length || this.DEFAULT_VECTOR_SIZE;
    await this.createCollection(vectorSize);

    try {
      const points = await client.search(COLLECTION_NAME, {
        vector: params.vector,
        filter: {
          must: [
            {
              key: "businessId",
              match: { value: params.businessId },
            },
          ],
        },
        limit: params.limit || 5,
        with_payload: true,
      }); 
      return points;
    } catch (error) {
      const apiError = error as any;
      if (apiError?.status === 400) {
        logger.warn("Qdrant search returned 400; recreating collection and retrying once", {
          vectorSize,
          errorData: apiError?.data,
        });
        await this.recreateCollection(vectorSize);
        return [];
      }
      logger.warn("Qdrant search failed; returning empty context", {
        error,
        businessId: params.businessId,
        vectorSize: params.vector.length,
      });
      return [];
    }
  }

  static async deleteVectorsByBusiness(businessId: string): Promise<void> {
    const client = this.getClient();
    if (!client) {
      return;
    }

    await client.delete(COLLECTION_NAME, {
      filter: {
        must: [
          {
            key: "businessId",
            match: { value: businessId },
          },
        ],
      },
    });
  }

  static async deleteVectorsByCatalogItem(catalogItemId: string): Promise<void> {
    const client = this.getClient();
    if (!client) {
      return;
    }

    await client.delete(COLLECTION_NAME, {
      filter: {
        must: [
          {
            key: "catalogItemId",
            match: { value: catalogItemId },
          },
        ],
      },
    });
  }
}

