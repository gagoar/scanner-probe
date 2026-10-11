        return super.toAssignableList(exprList, isBinding);
      }
      reportReservedArrowTypeParam(node) {
        if (node.params.length === 1 && !node.extra?.trailingComma && disallowAmbiguousJSXLike) {
          this.raise(node.start, TypeScriptError.ReservedArrowTypeParam);
        }
      }
      parseExprAtom(refDestructuringErrors, forInit, forNew) {
        if (this.type === tokTypes.jsxText) {
          return this.jsx_parseText();
        } else if (this.type === tokTypes.jsxTagStart) {
          return this.jsx_parseElement();
        } else if (this.type === tokTypes.at) {
          this.parseDecorators();
          return this.parseExprAtom();
        } else if (tokenIsIdentifier(this.type)) {
          let canBeArrow = this.potentialArrowAt === this.start;
          let startPos = this.start, startLoc = this.startLoc, containsEsc = this.containsEsc;
          let id = this.parseIdent(false);
          if (this.ecmaVersion >= 8 && !containsEsc && id.name === "async" && !this.canInsertSemicolon() && this.eat(tt._function)) {
            this.overrideContext(tokContexts.f_expr);
            return this.parseFunction(
