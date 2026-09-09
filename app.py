<<<<<<< HEAD
import os
import torch
import joblib
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from fastapi.middleware.cors import CORSMiddleware

ml_models = {}
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = BASE_DIR

@asynccontextmanager
async def lifespan(app : FastAPI):
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Loading model artifacts on {device}")

    
    try:
        ml_models["tokenizer"] = AutoTokenizer.from_pretrained(MODEL_DIR)
        ml_models["model"] = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR)
        ml_models["model"].eval()
        ml_models["label_encoder"] = joblib.load(os.path.join(MODEL_DIR, "label_encoder.joblib"))
        ml_models["device"] = device
        print("Model loaded successfully")
    except Exception as e:
        print(f"Error loading model artifacts: {e}")
        raise e
    yield

    # app = FastAPI(title="Twitter Sentiment Classifier", lifespan = lifespan) 
    ml_models.clear()
app = FastAPI(
    title="Tweet Intent Classification API",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

class PredictRequest(BaseModel):
    text: str
class PredictResponse(BaseModel):
    text: str
    intent: str
    confidence: float

@app.get("/")
def health_check():
    return{"status": "healthy", "device": ml_models.get("device", "unknown")}

@app.post("/predict", response_model = PredictResponse)
def predict_intent(request: PredictRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    tokenizer = ml_models["tokenizer"]
    model = ml_models["model"]
    label_encoder = ml_models["label_encoder"]
    device = ml_models["device"]

    inputs = tokenizer(
        request.text,
        padding=True,
        truncation=True,
        max_length=35,
        return_tensors="pt",
        # return_token_type_ids=False
    ).to(device)

    inputs.pop("token_type_ids", None)

    with torch.no_grad():
        outputs = model(**inputs)
        probabilties = torch.softmax(outputs.logits, dim=1)
        confidence, predicted_idx = torch.max(probabilties, dim=1)

    predicted_label = label_encoder.inverse_transform([predicted_idx.item()])[0]

    return PredictResponse(
        text=request.text,
        intent=str(predicted_label),
        confidence=round(confidence.item(), 4)
    )

=======
import os
import torch
import joblib
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from fastapi.middleware.cors import CORSMiddleware

ml_models = {}
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = BASE_DIR

@asynccontextmanager
async def lifespan(app : FastAPI):
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Loading model artifacts on {device}")

    
    try:
        ml_models["tokenizer"] = AutoTokenizer.from_pretrained(MODEL_DIR)
        ml_models["model"] = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR)
        ml_models["model"].eval()
        ml_models["label_encoder"] = joblib.load(os.path.join(MODEL_DIR, "label_encoder.joblib"))
        ml_models["device"] = device
        print("Model loaded successfully")
    except Exception as e:
        print(f"Error loading model artifacts: {e}")
        raise e
    yieldow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

class PredictRequest(BaseModel):
    text: str
class PredictResponse(BaseModel):
    text: str
    intent: str
    confidence: float

@app.get("/")
def health_check():
    return{"status": "healthy", "device": ml_models.get("device", "unknown")}

@app.get("/labels")
def get_labels():
    encoder = ml_models.get("label_encoder")
    return {"labels":list(encoder.classes_) if encoder else []}

@app.post("/predict", response_model = PredictResponse)
def predict_intent(request: PredictRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    tokenizer = ml_models["tokenizer"]
    model = ml_models["model"]
    label_encoder = ml_models["label_encoder"]
    device = ml_models["device"]

    inputs = tokenizer(
        request.text,
        padding=True,
        truncation=True,
        max_length=35,
        return_tensors="pt"
    ).to(device)
    
    inputs.pop("token_type_ids", None)

    with torch.no_grad():
        outputs = model(**inputs)
        probabilties = torch.softmax(outputs.logits, dim=1)
        confidence, predicted_idx = torch.max(probabilties, dim=1)

    predicted_label = label_encoder.inverse_transform([predicted_idx.item()])[0]

    return PredictResponse(
        text=request.text,
        intent=str(predicted_label),
        confidence=round(confidence.item(), 4)
    )

>>>>>>> eb173b7de037c515a1b1e0dd8a5a81d30015c6eb

    # app = FastAPI(title="Twitter Sentiment Classifier", lifespan = lifespan) 
    ml_models.clear()
app = FastAPI(
    title="Tweet Intent Classification API",
    version="1.0.0",
    lifespan=lifespan
)
app.add_middleware(
    CORSMiddleware,
    all
