import * as express from "express";
import { CatalogController } from "../controllers/catalog.controller";
import { authentification } from "../../../middlewares/authentication.middleware";
import { attachBusinessContext } from "../../../middlewares/tenant.middleware";
import { validateDto } from "../../../middlewares/validateDto.middleware";
import { CreateCatalogDto, UpdateCatalogDto } from "../dto/catalog.dto";

const Router = express.Router();

Router.post(
  "/",
  authentification,
  attachBusinessContext,
  validateDto(CreateCatalogDto),
  (req, res, next) => CatalogController.create(req, res).catch(next)
);

Router.get("/", authentification, attachBusinessContext, (req, res, next) =>
  CatalogController.list(req, res).catch(next)
);

Router.put(
  "/:id",
  authentification,
  attachBusinessContext,
  validateDto(UpdateCatalogDto),
  (req, res, next) => CatalogController.update(req, res).catch(next)
);

Router.delete("/:id", authentification, attachBusinessContext, (req, res, next) =>
  CatalogController.remove(req, res).catch(next)
);

export default Router;

