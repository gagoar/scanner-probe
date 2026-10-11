          node.exportKind = "type";
        }
        if (isDeclare) {
          this.resetStartLocation(declaration, startPos, startLoc);
          declaration.declare = true;
        }
