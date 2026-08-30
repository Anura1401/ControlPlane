from abc import ABC, abstractmethod
from app.schemas import RequestContext, DetectorResult

class BaseDetector(ABC):
    """
    Abstract Base Detector class representing the interface that all detectors must implement.
    """
    @abstractmethod
    def detect(self, context: RequestContext) -> DetectorResult:
        """
        Executes risk detection logic.
        
        Args:
            context (RequestContext): The request payload and metadata.
            
        Returns:
            DetectorResult: Structured risk analysis and status.
        """
        pass
