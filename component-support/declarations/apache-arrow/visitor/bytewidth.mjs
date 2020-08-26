/* istanbul ignore file */
import { Visitor } from "../visitor";
import { TimeUnit } from "../enum";
/** @ignore */ const sum = (x, y) => x + y;
/** @ignore */ const variableWidthColumnErrorMessage = type =>
  `Cannot compute the byte width of variable-width column ${type}`;
/** @ignore */
export class ByteWidthVisitor extends Visitor {
  visitNull(____) {
    return 0;
  }
  visitInt(type) {
    return type.bitWidth / 8;
  }
  visitFloat(type) {
    return type.ArrayType.BYTES_PER_ELEMENT;
  }
  visitBinary(type) {
    throw new Error(variableWidthColumnErrorMessage(type));
  }
  visitUtf8(type) {
    throw new Error(variableWidthColumnErrorMessage(type));
  }
  visitBool(____) {
    return 1 / 8;
  }
  visitDecimal(____) {
    return 16;
  }
  visitDate(type) {
    return (type.unit + 1) * 4;
  }
  visitTime(type) {
    return type.bitWidth / 8;
  }
  visitTimestamp(type) {
    return type.unit === TimeUnit.SECOND ? 4 : 8;
  }
  visitInterval(type) {
    return (type.unit + 1) * 4;
  }
  visitList(type) {
    throw new Error(variableWidthColumnErrorMessage(type));
  }
  visitStruct(type) {
    return this.visitFields(type.children).reduce(sum, 0);
  }
  visitUnion(type) {
    return this.visitFields(type.children).reduce(sum, 0);
  }
  visitFixedSizeBinary(type) {
    return type.byteWidth;
  }
  visitFixedSizeList(type) {
    return type.listSize * this.visitFields(type.children).reduce(sum, 0);
  }
  visitMap(type) {
    return this.visitFields(type.children).reduce(sum, 0);
  }
  visitDictionary(type) {
    return this.visit(type.indices);
  }
  visitFields(fields) {
    return (fields || []).map(field => this.visit(field.type));
  }
  visitSchema(schema) {
    return this.visitFields(schema.fields).reduce(sum, 0);
  }
}
/** @ignore */
export const instance = new ByteWidthVisitor();

//# sourceMappingURL=bytewidth.mjs.map
