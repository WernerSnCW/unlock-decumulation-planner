import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import investorRouter from "./investor";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(investorRouter);
router.use(adminRouter);

export default router;
