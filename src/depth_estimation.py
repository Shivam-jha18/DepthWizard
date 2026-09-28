import torch
import cv2
import numpy as np
import os

class DepthEstimator:
    def __init__(self, model_name="vits"):
        """
        Initializes the Depth Anything v2 model using Hugging Face transformers.
        model_name can be 'vits', 'vitb', 'vitl'.
        """
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        print(f"Using device for Depth Estimation: {self.device}")
        
        try:
            from transformers import pipeline
            model_map = {
                "vits": "depth-anything/Depth-Anything-V2-Small-hf",
                "vitb": "depth-anything/Depth-Anything-V2-Base-hf",
                "vitl": "depth-anything/Depth-Anything-V2-Large-hf"
            }
            hf_model = model_map.get(model_name, "depth-anything/Depth-Anything-V2-Small-hf")
            print(f"Loading model {hf_model} from Hugging Face...")
            
            # Initialize the depth estimation pipeline
            self.pipe = pipeline(task="depth-estimation", model=hf_model, device=0 if torch.cuda.is_available() else -1)
            
            # Auto-detect fine-tuned GAMUS LoRA weights
            lora_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "models", "weights", "depth_anything_v2_gamus_lora"))
            self.has_lora = False
            self.use_lora = False
            if os.path.exists(lora_dir):
                try:
                    from peft import PeftModel
                    self.pipe.model = PeftModel.from_pretrained(self.pipe.model, lora_dir)
                    self.has_lora = True
                    self.use_lora = True
                    # Enable LoRA adapter layers for fine-tuned satellite depth inference
                    if hasattr(self.pipe.model, "enable_adapter_layers"):
                        self.pipe.model.enable_adapter_layers()
                    print("[GAMUS LoRA] Enabled - fine-tuned satellite depth inference active.")
                except Exception as peft_err:
                    print(f"LoRA loading failed: {peft_err}. Running base model.")
            else:
                print("Depth Anything v2 base model loaded (no LoRA weights found).")

            self.model = True
        except Exception as e:
            print(f"Error loading model: {e}")
            print("Please ensure internet connection and 'transformers' library is installed.")
            self.model = None

    def predict_depth(self, image_rgb):
        """
        Takes an RGB image (numpy array, HxWxC) and returns a relative depth map (HxW).
        """
        if self.model is None:
            raise RuntimeError("Model is not initialized.")
            
        from PIL import Image
        pil_img = Image.fromarray(image_rgb)
        
        result = self.pipe(pil_img)
        depth_pil = result["depth"]
        depth_map = np.array(depth_pil).astype(np.float32)
            
        depth_min = depth_map.min()
        depth_max = depth_map.max()
        if depth_max - depth_min > 0:
            depth_normalized = (depth_map - depth_min) / (depth_max - depth_min)
        else:
            depth_normalized = np.zeros_like(depth_map)
            
        return depth_normalized, depth_map