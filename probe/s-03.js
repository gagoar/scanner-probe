          }
          if (this.shouldParseExportStatement()) {
            node.declaration = this.parseExportDeclaration(node);
            if (node.declaration.type === "VariableDeclaration")
              this.checkVariableExport(exports2, node.declaration.declarations);
            else this.checkExport(exports2, node.declaration.id, node.declaration.id.start);
            node.specifiers = [];
            node.source = null;
          } else {
            node.declaration = null;
            node.specifiers = this.parseExportSpecifiers(exports2);
            if (this.eatContextual("from")) {
              if (this.type !== tt.string) this.unexpected();
              node.source = this.parseExprAtom();
              this.parseMaybeImportAttributes(node);
            } else {
              for (let spec of node.specifiers) {
                this.checkUnreserved(spec.local);
                this.checkLocalExport(spec.local);
                if (spec.local.type === "Literal") {
                  this.raise(
                    spec.local.start,
