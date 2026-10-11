          this.semicolon();
          this.importOrExportOuterKind = void 0;
          return this.finishNode(decl, "TSNamespaceExportDeclaration");
        } else {
          const lookahead2 = this.lookahead(2).type;
          if (this.ts_isContextualWithState(enterHead, tokTypes.type) && (lookahead2 === tt.braceL ||
          lookahead2 === tt.star)) {
            this.next();
            this.importOrExportOuterKind = "type";
            node.exportKind = "type";
          } else {
            this.importOrExportOuterKind = "value";
            node.exportKind = "value";
          }
          this.next();
          if (this.eat(tt.star)) {
            return this.parseExportAllDeclaration(node, exports2);
          }
          if (this.eat(tt._default)) {
            this.checkExport(exports2, "default", this.lastTokStart);
            node.declaration = this.parseExportDefaultDeclaration();
            return this.finishNode(node, "ExportDefaultDeclaration");
