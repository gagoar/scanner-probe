      while (this.pos < this.input.length && count++ < 10) {
        ch = this.input[this.pos++];
        if (ch === ";") {
          if (str[0] === "#") {
            let value;
            if (str[1] === "x" || str[1] === "X") {
              str = str.substr(2);
              if (hexNumber.test(str)) value = parseInt(str, 16);
            } else {
              str = str.substr(1);
              if (decimalNumber.test(str)) value = parseInt(str, 10);
            }
            if (value !== void 0 && value <= 1114111) {
              entity = String.fromCodePoint(value);
            }
          } else if (Object.prototype.hasOwnProperty.call(xhtml_default, str)) {
            entity = xhtml_default[str];
          }
          break;
        }
        str += ch;
      }
      if (entity === void 0) {
        this.pos = startPos;
        return "&";
      }
      return entity;
    }
    jsx_readWord() {
      let ch, start = this.pos;
      do {
        ch = this.input.charCodeAt(++this.pos);
      } while (isIdentifierChar(ch) || ch === 45);
      return this.finishToken(tok.jsxName, this.input.slice(start, this.pos));
    }
    jsx_parseIdentifier() {
      let node = this.startNode();
      if (this.type === tok.jsxName) node.name = this.value;
      else if (this.type.keyword) node.name = this.type.keyword;
      else this.unexpected();
      this.next();
      return this.finishNode(node, "JSXIdentifier");
    }
    jsx_parseNamespacedName() {
      let startPos = this.start, startLoc = this.startLoc;
      let name = this.jsx_parseIdentifier();
      if (!options.allowNamespaces || !this.eat(tt.colon)) return name;
      var node = this.startNodeAt(startPos, startLoc);
      node.namespace = name;
      node.name = this.jsx_parseIdentifier();
      return this.finishNode(node, "JSXNamespacedName");
    }
    jsx_parseElementName() {
      if (this.type === tok.jsxTagEnd) return "";
      let startPos = this.start, startLoc = this.startLoc;
      let node = this.jsx_parseNamespacedName();
      if (this.type === tt.dot && node.type === "JSXNamespacedName" && !options.allowNamespacedObjects) {
        this.unexpected();
      }
      while (this.eat(tt.dot)) {
        let newNode = this.startNodeAt(startPos, startLoc);
        newNode.object = node;
        newNode.property = this.jsx_parseIdentifier();
        node = this.finishNode(newNode, "JSXMemberExpression");
      }
      return node;
    }
    jsx_parseAttributeValue() {
      switch (this.type) {
        case tt.braceL:
          let node = this.jsx_parseExpressionContainer();
          if (node.expression.type === "JSXEmptyExpression")
            this.raise(node.start, "JSX attributes must only be assigned a non-empty expression");
          return node;
        case tok.jsxTagStart:
        case tt.string:
          return this.parseExprAtom();
        default:
          this.raise(this.start, "JSX value should be either an expression or a quoted JSX text");
      }
    }
    jsx_parseEmptyExpression() {
      let node = this.startNodeAt(this.lastTokEnd, this.lastTokEndLoc);
      return this.finishNodeAt(node, "JSXEmptyExpression", this.start, this.startLoc);
    }
    jsx_parseExpressionContainer() {
      let node = this.startNode();
      this.next();
      if (this.eat(tt.ellipsis)) {
        node.expression = this.parseExpression();
        this.expect(tt.braceR);
        return this.finishNode(node, "JSXSpreadChild");
      }
      node.expression = this.type === tt.braceR ? this.jsx_parseEmptyExpression() : this.parseExpression();
      this.expect(tt.braceR);
      return this.finishNode(node, "JSXExpressionContainer");
    }
    jsx_parseAttribute() {
      let node = this.startNode();
      if (this.eat(tt.braceL)) {
        this.expect(tt.ellipsis);
        node.argument = this.parseMaybeAssign();
        this.expect(tt.braceR);
        return this.finishNode(node, "JSXSpreadAttribute");
      }
      node.name = this.jsx_parseNamespacedName();
      node.value = this.eat(tt.eq) ? this.jsx_parseAttributeValue() : null;
      return this.finishNode(node, "JSXAttribute");
    }
    jsx_parseOpeningElementAt(startPos, startLoc) {
      let node = this.startNodeAt(startPos, startLoc);
      node.attributes = [];
      let nodeName = this.jsx_parseElementName();
      if (nodeName) node.name = nodeName;
      while (this.type !== tt.slash && this.type !== tok.jsxTagEnd)
        node.attributes.push(this.jsx_parseAttribute());
      node.selfClosing = this.eat(tt.slash);
      this.expect(tok.jsxTagEnd);
      return this.finishNode(node, nodeName ? "JSXOpeningElement" : "JSXOpeningFragment");
    }
    jsx_parseClosingElementAt(startPos, startLoc) {
      let node = this.startNodeAt(startPos, startLoc);
      let nodeName = this.jsx_parseElementName();
      if (nodeName) node.name = nodeName;
      this.expect(tok.jsxTagEnd);
      return this.finishNode(node, nodeName ? "JSXClosingElement" : "JSXClosingFragment");
    }
    jsx_parseElementAt(startPos, startLoc) {
      let node = this.startNodeAt(startPos, startLoc);
      let children = [];
      let openingElement = this.jsx_parseOpeningElementAt(startPos, startLoc);
      let closingElement = null;
      if (!openingElement.selfClosing) {
        contents: for (; ; ) {
          switch (this.type) {
            case tok.jsxTagStart:
              startPos = this.start;
              startLoc = this.startLoc;
              this.next();
              if (this.eat(tt.slash)) {
                closingElement = this.jsx_parseClosingElementAt(startPos, startLoc);
                break contents;
              }
              children.push(this.jsx_parseElementAt(startPos, startLoc));
              break;
            case tok.jsxText:
              children.push(this.parseExprAtom());
              break;
            case tt.braceL:
              children.push(this.jsx_parseExpressionContainer());
              break;
            default:
              this.unexpected();
          }
        }
        if (getQualifiedJSXName(closingElement.name) !== getQualifiedJSXName(openingElement.name)) {
          this.raise(
            closingElement.start,
            "Expected corresponding JSX closing tag for <" + getQualifiedJSXName(openingElement.name) + ">"
          );
        }
      }
      let fragmentOrElement = openingElement.name ? "Element" : "Fragment";
      node["opening" + fragmentOrElement] = openingElement;
      node["closing" + fragmentOrElement] = closingElement;
      node.children = children;
      if (this.type === tt.relational && this.value === "<") {
        this.raise(this.start, "Adjacent JSX elements must be wrapped in an enclosing tag");
      }
      return this.finishNode(node, "JSX" + fragmentOrElement);
    }
    jsx_parseText() {
      let node = this.parseLiteral(this.value);
      node.type = "JSXText";
      return node;
    }
    jsx_parseElement() {
      let startPos = this.start, startLoc = this.startLoc;
      this.next();
      return this.jsx_parseElementAt(startPos, startLoc);
    }
  };
}
function generateParseImportAssertions(Parse, acornTypeScript, acorn) {
  const { tokTypes } = acornTypeScript;
  const { tokTypes: tt } = acorn;
  return class ImportAttributes extends Parse {
    parseMaybeImportAttributes(node) {
      if (this.type === tt._with || this.type === tokTypes.assert) {
        this.next();
        const attributes = this.parseImportAttributes();
        if (attributes) {
          node.attributes = attributes;
        }
      }
    }
    parseImportAttributes() {
      this.expect(tt.braceL);
      const attrs = this.parseWithEntries();
      this.expect(tt.braceR);
      return attrs;
    }
    parseWithEntries() {
      const attrs = [];
      const attrNames = new Set();
      do {
        if (this.type === tt.braceR) {
          break;
        }
        const node = this.startNode();
        let withionKeyNode;
        if (this.type === tt.string) {
          withionKeyNode = this.parseLiteral(this.value);
        } else {
          withionKeyNode = this.parseIdent(true);
        }
        this.next();
        node.key = withionKeyNode;
        if (attrNames.has(node.key.name)) {
          this.raise(this.pos, "Duplicated key in attributes");
        }
        attrNames.add(node.key.name);
        if (this.type !== tt.string) {
          this.raise(this.pos, "Only string is supported as an attribute value");
        }
        node.value = this.parseLiteral(this.value);
        attrs.push(this.finishNode(node, "ImportAttribute"));
      } while (this.eat(tt.comma));
      return attrs;
    }
  };
}
var parserCallbackNames = [
  "onToken",
  "onComment",
  "onInsertedSemicolon",
  "onTrailingComma"
];
function makeOutputBuffer() {
  return {
    _tag: "BufferedParserEvents",
    segments: []
  };
}
var emptyOutputBuffer = makeOutputBuffer();
function hasEvents(output) {
  return output.segments.length > 0;
}
var ParseEffects = class {
  constructor(options, state) {
    this.options = options;
    this.state = state;
    this.callbacks = {};
    this.callbackWrappers = {};
    this.frames = [];
    this.undoLog = [];
    this.hasCallbacks = this.captureCallbacks();
  }
  get active() {
    return this.frames.length > 0;
  }
  begin() {
    const frame = {
      _tag: "ParseEffectFrame",
      depth: this.frames.length,
      undoMark: this.undoLog.length,
      checkpoint: this.state?.capture()
    };
    this.frames.push(frame);
    if (frame.depth === 0 && this.hasCallbacks) {
      this.activateCallbacks();
    }
    return frame;
  }
  commit(frame) {
    this.close(frame);
    const parent = this.currentFrame();
    if (parent) {
      if (frame.output) {
        this.appendOutput(this.outputFor(parent), frame.output);
      }
      return;
    }
    this.undoLog.length = frame.undoMark;
    if (frame.output) {
      this.flush(frame.output);
    }
  }
  rollback(frame) {
    this.close(frame);
    this.unwind(frame.undoMark);
    this.restore(frame);
  }
  rollbackWithEvents(frame) {
    this.close(frame);
    this.unwind(frame.undoMark);
    this.restore(frame);
    return frame.output ?? emptyOutputBuffer;
  }
  replay(events) {
    if (!hasEvents(events)) return;
    const frame = this.currentFrame();
    if (frame) {
      this.appendOutput(this.outputFor(frame), events);
      return;
    }
    this.flush(events);
  }
  ["set"](target, key, value) {
    this.willSet(target, key);
    target[key] = value;
  }
  remove(target, key) {
    this.willSet(target, key);
    delete target[key];
  }
  append(target, value) {
    this.willAppend(target);
    target.push(value);
  }
  pop(target) {
    this.willMutateTail(target, 1);
    return target.pop();
  }
  truncate(target, length) {
    if (length < target.length) {
      this.willMutateTail(target, target.length - length);
    } else {
      this.willAppend(target);
    }
    target.length = length;
  }
  modify(target, key, f) {
    const [result, next] = f(target[key]);
    this.set(target, key, next);
    return result;
  }
  willAppend(target) {
    if (!this.active) return;
    this.undoLog.push({
      _tag: "ArrayLength",
      target,
