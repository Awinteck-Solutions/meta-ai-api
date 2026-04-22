import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Business from "../Features/businesses/schema/business.schema";
import Customer from "../Features/customers/schema/customer.schema";
import CatalogItem from "../Features/catalog/schema/catalog.schema";
import { OrdersService } from "../Features/orders/services/orders.service";

describe("Order creation", () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it("creates order with total amount", async () => {
    const business = await Business.create({
      ownerId: new mongoose.Types.ObjectId(),
      name: "Test Business",
      businessType: "both",
    });

    const customer = await Customer.create({
      businessId: business._id,
      phone: "233000111222",
      name: "Jane Doe",
    });

    const product = await CatalogItem.create({
      businessId: business._id,
      type: "product",
      name: "Bag",
      price: 50,
      discountAmount: 5,
      quantity: 10,
      active: true,
    });

    const order = await OrdersService.create(String(business._id), {
      customerId: String(customer._id),
      items: [{ catalogItemId: String(product._id), quantity: 2 }],
    });

    expect(order).toBeTruthy();
    expect(order.totalAmount).toBe(90);
  });
});

