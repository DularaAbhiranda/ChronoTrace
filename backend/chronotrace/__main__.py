"""Allow `python -m chronotrace <args>` to invoke the CLI."""
from chronotrace.cli import main
import sys

if __name__ == "__main__":
    sys.exit(main())
