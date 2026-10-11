      }
      parseClassId(node, isStatement) {
        if (!isStatement && this.isContextual("implements")) {
          return;
        }
        super.parseClassId(node, isStatement);
        const typeParameters = this.tsTryParseTypeParameters(
          this.tsParseClassTypeParameterModifiers.bind(this)
        );
        if (typeParameters) node.typeParameters = typeParameters;
      }
      parseClassPropertyAnnotation(node) {
