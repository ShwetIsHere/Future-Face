# Microsoft Azure Deployment Guide for FutureFace

This guide details how to deploy the **FutureFace** AI Age Progression application to **Microsoft Azure**.

---

## Architecture Overview

FutureFace is powered by:
- **Web App**: Flask + Gunicorn (Python 3.10)
- **Face Quality & Landmark Pipeline**: OpenCV YuNet + Facial Landmark geometry
- **Age Estimation**: PyTorch ResNet-50
- **Age Progression / Regression**: StyleGAN2 SAM (`sam_ffhq_aging.pt` 2.27 GB)

---

## Deployment Options on Azure

| Option | Best For | Recommended Hardware | Cost Profile |
| :--- | :--- | :--- | :--- |
| **Option 1: Azure Container Apps (ACA)** | Production Web Service | 2 vCPU, 4–8 GB RAM | Low / Pay-per-second |
| **Option 2: Azure App Service (Docker)** | Traditional PaaS Hosting | B2 / P1v3 Linux Plan | Predictable monthly |
| **Option 3: Azure GPU VM (NC-Series)** | High Performance (1.4s generation) | Standard_NC4as_T4_v3 or NC6s_v3 | Dedicated GPU |

---

## Option 1: Deploy with Azure Container Apps / ACR (Recommended)

### Step 1: Create an Azure Container Registry (ACR)
```bash
az group create --name futureface-rg --location eastus
az acr create --resource-group futureface-rg --name futurefaceacr --sku Basic --admin-enabled true
```

### Step 2: Build and Push Docker Image to ACR
```bash
# Log in to your Azure Container Registry
az acr login --name futurefaceacr

# Build and tag the container image
docker build -t futurefaceacr.azurecr.io/futureface:latest .

# Push image to ACR
docker push futurefaceacr.azurecr.io/futureface:latest
```

### Step 3: Deploy to Azure Container Apps
```bash
# Create an Azure Container Apps environment
az containerapp env create \
  --name futureface-env \
  --resource-group futureface-rg \
  --location eastus

# Deploy the container app
az containerapp create \
  --name futureface \
  --resource-group futureface-rg \
  --environment futureface-env \
  --image futurefaceacr.azurecr.io/futureface:latest \
  --target-port 5000 \
  --ingress external \
  --cpu 2.0 \
  --memory 4.0Gi \
  --registry-server futurefaceacr.azurecr.io \
  --env-vars \
    PORT=5000 \
    WEB_CONCURRENCY=1 \
    GUNICORN_TIMEOUT=300
```

---

## Option 2: Deploy to Azure App Service (Custom Container)

```bash
# Create an App Service plan (Linux)
az appservice plan create \
  --name futureface-plan \
  --resource-group futureface-rg \
  --sku B2 \
  --is-linux

# Create Web App with Docker container
az webapp create \
  --resource-group futureface-rg \
  --plan futureface-plan \
  --name futureface-app \
  --deployment-container-image-name futurefaceacr.azurecr.io/futureface:latest

# Configure App Settings in Azure Portal
az webapp config appsettings set \
  --resource-group futureface-rg \
  --name futureface-app \
  --settings \
    WEBSITES_PORT=5000 \
    PORT=5000 \
    GUNICORN_TIMEOUT=300
```

---

## Option 3: Deploy on an Azure GPU Virtual Machine (Fastest Inference)

For real-time 1.4-second inference using NVIDIA CUDA on Azure:

1. Create an Azure GPU VM:
   - Size: **Standard_NC4as_T4_v3** (1 NVIDIA T4 GPU, 16 GB VRAM) or **Standard_NC6s_v3**
   - Image: **Ubuntu 22.04 LTS (NVIDIA GPU Optimized)**
2. SSH into the VM:
   ```bash
   ssh azureuser@<YOUR-VM-IP>
   ```
3. Clone and set up repository:
   ```bash
   git clone https://github.com/ShwetIsHere/Future-Face.git
   cd Future-Face
   
   # Create virtual environment
   python3 -m venv venv
   source venv/bin/activate
   
   # Install dependencies
   pip install --upgrade pip
   pip install -r requirements.txt
   ```
4. Place or download model weights (`download_models.py`):
   ```bash
   python download_models.py
   ```
5. Start server using Gunicorn:
   ```bash
   gunicorn -c gunicorn.conf.py app:app
   ```

---

## Managing Large Model Checkpoints on Azure

Because `sam_ffhq_aging.pt` (2.27 GB) exceeds standard GitHub repository limits, choose one of these methods on Azure:

### Method A: Azure Blob Storage (Recommended)
1. Upload `sam_ffhq_aging.pt` to an Azure Blob container (e.g. `models/sam_ffhq_aging.pt`).
2. Generate a read-only SAS URL for the blob.
3. In Azure App Service / Container Apps, add the Environment Variable:
   - `AZURE_SAM_MODEL_URL = "https://<storage>.blob.core.windows.net/models/sam_ffhq_aging.pt?<SAS-TOKEN>"`
4. Run `python download_models.py` before starting, and it will automatically stream the checkpoint.

### Method B: Azure File Share (Persistent Volume Mount)
Mount an Azure File Share directory to `/app/SAM-official/pretrained_models` in your Container App or App Service. The model persists without re-downloading on container restarts.

---

## Environment Variables Reference

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `5000` | Port on which the web server listens |
| `HOST` | `0.0.0.0` | Network binding host address |
| `PYTHON_EXE` | `sys.executable` | Path to python interpreter for SAM subprocess |
| `WEB_CONCURRENCY` | `1` | Number of Gunicorn worker processes (1 is recommended for PyTorch memory efficiency) |
| `GUNICORN_TIMEOUT` | `300` | Worker timeout in seconds (prevents worker timeouts during heavy model inference) |
| `AZURE_SAM_MODEL_URL` | *None* | Optional direct download URL for the 2.27GB aging checkpoint |

---

## Verification Test

To verify that your deployment is healthy, test the health endpoint:
```bash
curl https://<YOUR-APP-URL>/api/health
```
Expected response:
```json
{
  "status": "ready",
  "device": "cuda",
  "gpu": "NVIDIA T4",
  "pytorch": "2.5.1",
  "opencv": "4.10.0"
}
```
