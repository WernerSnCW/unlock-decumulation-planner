import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import investorRouter from "./investor";
import adminRouter from "./admin";
import extractRouter from "./extract";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(investorRouter);
router.use(adminRouter);
router.use(extractRouter);

export default router;
