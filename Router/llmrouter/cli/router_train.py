
import argparse
import os
import sys
from typing import Dict, Any, Optional, Tuple
from custom_routers.greenrouter import GreenKNNRouter, GreenKNNRouterTrainer
 
from llmrouter.models import (
    KNNRouter,
    KNNRouterTrainer,
)
 
ROUTER_TRAINER_REGISTRY: Dict[str, Tuple[Any, Any]] = {
    "knnrouter": (KNNRouter, KNNRouterTrainer),
    "greenrouter": (GreenKNNRouter, GreenKNNRouterTrainer),  # ← ajouter
}
 
UNSUPPORTED_ROUTERS = {
    "smallest_llm": "SmallestLLM is a baseline router that does not require training",
    "largest_llm": "LargestLLM is a baseline router that does not require training",
    "llmmultiroundrouter": "LLMMultiRoundRouter does not have a trainer implementation",
    "router_r1": "RouterR1 is a pre-trained model and does not support training via this CLI",
    "router-r1": "RouterR1 is a pre-trained model and does not support training via this CLI",
}
 
 
def get_device(device_arg: Optional[str] = None) -> str:
    if device_arg:
        return device_arg
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda"
    except ImportError:
        pass
    return "cpu"
 
 
def load_router_and_trainer(
    router_name: str,
    config_path: str,
    device: str = "cpu",
) -> Tuple[Any, Any]:
    router_name_lower = router_name.lower()
 
    if router_name_lower in UNSUPPORTED_ROUTERS:
        raise ValueError(
            f"Router '{router_name}' does not support training.\n"
            f"Reason: {UNSUPPORTED_ROUTERS[router_name_lower]}"
        )
 
    if router_name_lower not in ROUTER_TRAINER_REGISTRY:
        raise ValueError(
            f"Unknown router: {router_name}.\n"
            f"Supported routers for training: {list(ROUTER_TRAINER_REGISTRY.keys())}"
        )
 
    router_class, trainer_class = ROUTER_TRAINER_REGISTRY[router_name_lower]
 
    try:
        router_instance = router_class(yaml_path=config_path)
    except Exception as e:
        raise ValueError(
            f"Failed to initialize router '{router_name}'.\n"
            f"Error: {str(e)}"
        ) from e
 
    try:
        trainer_instance = trainer_class(router=router_instance, device=device)
    except Exception as e:
        raise ValueError(
            f"Failed to initialize trainer for '{router_name}'.\n"
            f"Error: {str(e)}"
        ) from e
 
    return router_instance, trainer_instance
 
 
def train_router(
    router_name: str,
    config_path: str,
    device: str = "cpu",
    verbose: bool = True,
) -> None:
    if verbose:
        print("=" * 60)
        print(f"Starting Training for Router: {router_name}")
        print("=" * 60)
        print(f"Config file: {config_path}")
        print(f"Device: {device}")
        print("=" * 60)
        print("\nLoading router and trainer...")
 
    _, trainer_instance = load_router_and_trainer(router_name, config_path, device)
 
    if verbose:
        print("Router and trainer loaded successfully!")
        print(f"\nStarting training for {router_name}...\n")
 
    try:
        trainer_instance.train()
    except Exception as e:
        raise RuntimeError(f"Training failed: {str(e)}") from e
 
    if verbose:
        print(f"\nTraining completed for {router_name}!")
        print("=" * 60)
 
 
def main():
    parser = argparse.ArgumentParser(
        description="Router Training Script - KNN Only",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m llmrouter.cli.router_train --router knnrouter --config configs/model_config_train/knnrouter.yaml
        """
    )
 
    parser.add_argument("--router", type=str, required=True, help="Router method name (knnrouter)")
    parser.add_argument("--config", type=str, required=True, help="Path to YAML configuration file")
    parser.add_argument("--device", type=str, default=None, choices=["cuda", "cpu", "auto"], help="Device to use")
    parser.add_argument("--quiet", action="store_true", help="Suppress verbose output")
    parser.add_argument("--list-routers", action="store_true", help="List supported routers and exit")
 
    args = parser.parse_args()
 
    if args.list_routers:
        print("Supported routers for training:")
        print("=" * 60)
        for router_name, (router_class, trainer_class) in ROUTER_TRAINER_REGISTRY.items():
            print(f"  • {router_name}")
            print(f"    Router: {router_class.__name__}")
            print(f"    Trainer: {trainer_class.__name__}")
        sys.exit(0)
 
    if not os.path.exists(args.config):
        print(f"Error: Config file not found: {args.config}", file=sys.stderr)
        sys.exit(1)
 
    device = get_device(args.device if args.device != "auto" else None)
    verbose = not args.quiet
 
    try:
        train_router(
            router_name=args.router,
            config_path=args.config,
            device=device,
            verbose=verbose,
        )
    except Exception as e:
        print(f"\n❌ Error: {str(e)}", file=sys.stderr)
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)
 
 
if __name__ == "__main__":
    main()
 