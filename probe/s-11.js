        return declaration;
      }
      parseStatement(context, topLevel, exports2) {
        if (this.match(tokTypes.at)) {
          this.parseDecorators(true);
        }
        if (this.match(tt._const) && this.isLookaheadContextual("enum")) {
          const node = this.startNode();
          this.expect(tt._const);
          return this.tsParseEnumDeclaration(node, { const: true });
        }
        if (this.ts_isContextual(tokTypes.enum)) {
          return this.tsParseEnumDeclaration(this.startNode());
        }
        if (this.ts_isContextual(tokTypes.interface)) {
          const result = this.tsParseInterfaceDeclaration(this.startNode());
          if (result) return result;
        }
        return super.parseStatement(context, topLevel, exports2);
      }
      parseAccessModifier() {
        return this.tsParseModifier(["public", "protected", "private"]);
