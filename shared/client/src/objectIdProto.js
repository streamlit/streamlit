/**
 * Converts an immutable proto of an ObjectId into a hex string representation.
 */
export function getObjectIdString(id) {
  const toHexString = (number, bytes) => {
    console.log(`converting ${number} -> ${number.toString(16)}`)
    let hexString = '';
    for (let i = 0 ; i < bytes ; i++) {
      console.log(`${i}: ${((number >> (8 * i)) & 0xff).toString(16)}`);
      hexString =
        ('0' + ((number >> (8 * i)) & 0xff).toString(16)).slice(-2) +
        hexString;
    }
    return hexString;
  };
  const firstPart = id.get('firstPart');
  const secondPart = id.get('secondPart');
  return toHexString(firstPart, 4) + toHexString(secondPart, 8);
}
