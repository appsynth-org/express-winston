import traverse from 'traverse';
import isSecret from './is-secret';

export default function (redacted: string) {
  function map(obj: any) {
    const update = traverse(obj).map(function (val) {
      if (isSecret.key(this.key) || isSecret.value(val)) this.update(redacted);
    });

    return { ...obj, ...update };
  }

  function forEach(obj: any) {
    traverse(obj).forEach(function (val) {
      if (isSecret.key(this.key) || isSecret.value(val)) this.update(redacted);
    });
  }

  return {
    map,
    forEach,
  };
}
