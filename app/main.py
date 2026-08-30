import logging
from fastapi import FastAPI, HTTPException
from app.schemas import RequestContext, FinalDecision
from app.orchestrator import PlatformOrchestrator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

app = FastAPI(
    title="ControlPlane.ai",
    description="Enterprise AI Safety, Risk Detection & Policy Enforcement Platform",
    version="1.0.0"
)

# Instantiate orchestrator once at startup
orchestrator = None

@app.on_event("startup")
async def startup_event():
    global orchestrator
    orchestrator = PlatformOrchestrator()
    logging.info("ControlPlane.ai services initialized successfully.")

@app.post("/evaluate", response_model=FinalDecision)
async def evaluate(req: RequestContext) -> FinalDecision:
    """
    Evaluates request context safety risk policies and returns final decision (ALLOW, MODIFY, ESCALATE, BLOCK).
    """
    if orchestrator is None:
        raise HTTPException(status_code=503, detail="Governance engine is not ready.")
    try:
        decision = await orchestrator.execute(req)
        return decision
    except Exception as e:
        logging.error(f"Error evaluating request: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Governance evaluation failure: {str(e)}")

@app.get("/health")
async def health():
    """
    Returns platform health status.
    """
    return {"status": "ok", "service": "ControlPlane.ai", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    from app.config import HOST, PORT
    uvicorn.run(app, host=HOST, port=PORT)
