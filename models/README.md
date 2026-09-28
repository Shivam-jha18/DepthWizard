# DepthWizard Model Backbones

This directory structures the monocular depth estimation backbone architectures.

- **Active Model**: `Depth-Anything-V2-Small-hf`
- **Execution Engine**: Loaded seamlessly via Hugging Face `transformers` pipeline (`src/depth_estimation.py`).
- **Cache Location**: Model checkpoints are managed in the local cache (`~/.cache/huggingface/hub/`) and can also be saved offline to `models/weights/`.
