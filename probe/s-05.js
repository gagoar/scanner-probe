        if (node.type === "AssignmentPattern" && node.typeAnnotation && node.right.start < node.typeAnnotation.start) {
          this.raise(node.typeAnnotation.start, TypeScriptError.TypeAnnotationAfterAssign);
        }
        return node;
      }
      typeCastToParameter(node) {
        node.expression.typeAnnotation = node.typeAnnotation;
        this.resetEndLocation(
          node.expression,
          node.typeAnnotation.end,
          node.typeAnnotation.loc?.end
        );
        return node.expression;
      }
      toAssignableList(exprList, isBinding) {
        if (!exprList) exprList = [];
        for (let i = 0; i < exprList.length; i++) {
          const expr = exprList[i];
          if (expr?.type === "TSTypeCastExpression") {
            exprList[i] = this.typeCastToParameter(expr);
          }
        }
