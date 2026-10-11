            this.importOrExportOuterKind = "type";
            this.next();
          } else {
            node.importKind = "value";
            this.importOrExportOuterKind = "value";
          }
          const exportEqualsNode = this.tsParseImportEqualsDeclaration(
            node,
            true
          );
          this.importOrExportOuterKind = void 0;
          return exportEqualsNode;
        } else if (this.ts_eatWithState(tt.eq, 2, enterHead)) {
          const assign = node;
          assign.expression = this.parseExpression();
          this.semicolon();
          this.importOrExportOuterKind = void 0;
          return this.finishNode(assign, "TSExportAssignment");
        } else if (this.ts_eatContextualWithState("as", 2, enterHead)) {
          const decl = node;
          this.expectContextual("namespace");
          decl.id = this.parseIdent();
