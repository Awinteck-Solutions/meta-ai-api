import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Business from "../Features/businesses/schema/business.schema";
import { CatalogService } from "../Features/catalog/services/catalog.service";

describe("Catalog creation", () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it("creates a catalog item for a business", async () => {
    const business = await Business.create({
      ownerId: new mongoose.Types.ObjectId(),
      name: "Test Business",
      businessType: "both",
    });

    const item = await CatalogService.create(String(business._id), {
      type: "product",
      name: "Sneakers",
      price: 120,
      discountAmount: 10,
      quantity: 20,
      images: [],
      active: true,
    });

    expect(item).toBeTruthy();
    expect(item.name).toBe("Sneakers");
  });
});

