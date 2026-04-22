import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Business from "../Features/businesses/schema/business.schema";
import Customer from "../Features/customers/schema/customer.schema";
import CatalogItem from "../Features/catalog/schema/catalog.schema";
import { BookingsService } from "../Features/bookings/services/bookings.service";

describe("Booking creation", () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it("creates booking from a service item", async () => {
    const business = await Business.create({
      ownerId: new mongoose.Types.ObjectId(),
      name: "Test Business",
      businessType: "service",
    });

    const customer = await Customer.create({
      businessId: business._id,
      phone: "233555666777",
      name: "Kwame",
    });

    const service = await CatalogItem.create({
      businessId: business._id,
      type: "service",
      name: "Haircut",
      price: 20,
      durationMinutes: 45,
      active: true,
    });

    const booking = await BookingsService.create(String(business._id), {
      customerId: String(customer._id),
      serviceId: String(service._id),
      bookingDate: "2026-03-01",
      bookingTime: "10:00",
    });

    expect(booking).toBeTruthy();
    expect(booking.durationMinutes).toBe(45);
  });
});

