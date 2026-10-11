      parseConditional(expr, startPos, startLoc, forInit, refDestructuringErrors) {
        if (this.eat(tt.question)) {
          let node = this.startNodeAt(startPos, startLoc);
          node.test = expr;
          node.consequent = this.parseMaybeAssign();
          this.expect(tt.colon);
          node.alternate = this.parseMaybeAssign(forInit);
          return this.finishNode(node, "ConditionalExpression");
        }
        return expr;
      }
      parseMaybeConditional(forInit, refDestructuringErrors) {
        let startPos = this.start, startLoc = this.startLoc;
        let expr = this.parseExprOps(forInit, refDestructuringErrors);
        if (this.checkExpressionErrors(refDestructuringErrors)) return expr;
        if (!this.maybeInArrowParameters || !this.match(tt.question)) {
          return this.parseConditional(expr, startPos, startLoc, forInit, refDestructuringErrors);
        }
        const result = this.tryParse(
          () => this.parseConditional(expr, startPos, startLoc, forInit, refDestructuringErrors)
        );
        if (!result.node) {
