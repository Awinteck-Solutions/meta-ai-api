const swaggerAutogen = require("swagger-autogen");

const outputFile = "./swagger-output.json"; // Output file for generated Swagger spec
const endpointsFiles = ["./src/routes/all.routes.ts"]; // File(s) where your routes are defined

const swaggerOptions = {
  definition: {
    "awinteck-template-api": "1.0.0",
    info: {
      title: "Express API Documentation",
      version: "1.0.0",
      description: "API documentation for Express.js application",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development Server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./routes/*.js"],
};


const swaggerAutogenInstance = swaggerAutogen(); // Correctly initialize swagger-autogen

swaggerAutogenInstance(outputFile, endpointsFiles, swaggerOptions).then(() => {
  console.log("Swagger documentation generated!");
});
