                    "A string literal cannot be used as an exported binding without `from`."
                  );
                }
              }
              node.source = null;
            }
            this.semicolon();
          }
          return this.finishNode(node, "ExportNamedDeclaration");
        }
      }
      checkExport(exports2, name, _) {
        if (!exports2) {
          return;
        }
        if (typeof name !== "string") {
          name = name.type === "Identifier" ? name.name : name.value;
        }
        exports2[name] = true;
      }
      parseMaybeDefault(startPos, startLoc, left) {
        const node = super.parseMaybeDefault(startPos, startLoc, left);
