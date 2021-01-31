import * as assert from 'assert'
import * as Apply from '../src/Apply'
import * as E from '../src/Either'
import { pipe } from '../src/function'
import * as S from '../src/string'
import * as O from '../src/Option'
import * as R from '../src/Reader'
import * as _ from '../src/ReaderEither'
import { semigroupSum } from '../src/Semigroup'

describe('ReaderEither', () => {
  describe('pipeables', () => {
    it('map', () => {
      const double = (n: number) => n * 2
      assert.deepStrictEqual(pipe(_.right(1), _.map(double))({}), E.right(2))
    })

    it('alt', () => {
      assert.deepStrictEqual(
        pipe(
          _.right('a'),
          _.alt(() => _.right('b'))
        )({}),
        E.right('a')
      )
      assert.deepStrictEqual(
        pipe(
          _.left(1),
          _.alt(() => _.right('b'))
        )({}),
        E.right('b')
      )
    })

    it('ap', () => {
      const double = (n: number) => n * 2
      assert.deepStrictEqual(pipe(_.right(double), _.ap(_.right(1)))({}), E.right(2))
    })

    it('apFirst', () => {
      assert.deepStrictEqual(pipe(_.right('a'), _.apFirst(_.right('b')))({}), E.right('a'))
    })

    it('apSecond', () => {
      assert.deepStrictEqual(pipe(_.right('a'), _.apSecond(_.right('b')))({}), E.right('b'))
    })

    it('chainFirst', () => {
      const f = (n: number) => _.right(n * 2)
      assert.deepStrictEqual(pipe(_.right(1), _.chainFirst(f))({}), E.right(1))
    })

    it('chainFirstW', () => {
      const f = (n: number) => _.right<unknown, boolean, number>(n * 2)
      assert.deepStrictEqual(pipe(_.right<unknown, string, number>(1), _.chainFirstW(f))({}), E.right(1))
    })

    it('flatten', () => {
      assert.deepStrictEqual(pipe(_.right(_.right('a')), _.flatten)({}), E.right('a'))
    })

    it('mapLeft', () => {
      const len = (s: string) => s.length
      assert.deepStrictEqual(pipe(_.right(1), _.mapLeft(len))({}), E.right(1))
      assert.deepStrictEqual(pipe(_.left('aa'), _.mapLeft(len))({}), E.left(2))
    })

    it('bimap', () => {
      const double = (n: number) => n * 2
      const len = (s: string) => s.length
      assert.deepStrictEqual(pipe(_.right(1), _.bimap(len, double))({}), E.right(2))
      assert.deepStrictEqual(pipe(_.left('aaa'), _.bimap(len, double))({}), E.left(3))
    })

    it('fromOption', () => {
      assert.deepStrictEqual(
        pipe(
          O.none,
          _.fromOption(() => 'none')
        )({}),
        E.left('none')
      )
      assert.deepStrictEqual(
        pipe(
          O.some(1),
          _.fromOption(() => 'none')
        )({}),
        E.right(1)
      )
    })

    it('fromPredicate', () => {
      const gt2 = _.fromPredicate(
        (n: number) => n >= 2,
        (n) => `Invalid number ${n}`
      )
      assert.deepStrictEqual(gt2(3)({}), E.right(3))
      assert.deepStrictEqual(gt2(1)({}), E.left('Invalid number 1'))
    })

    it('filterOrElse', () => {
      const e1 = pipe(
        _.right(12),
        _.filterOrElse(
          (n) => n > 10,
          () => 'a'
        )
      )({})
      assert.deepStrictEqual(e1, E.right(12))
      const e2 = pipe(
        _.right(7),
        _.filterOrElse(
          (n) => n > 10,
          () => 'a'
        )
      )({})
      assert.deepStrictEqual(e2, E.left('a'))
    })
  })

  it('fold', () => {
    const fold = _.fold(
      (s: string) => R.of(s.length),
      (n: number) => R.of(n * 2)
    )
    assert.deepStrictEqual(fold(_.right(1))({}), 2)
    assert.deepStrictEqual(fold(_.left('aaa'))({}), 3)
  })

  it('getOrElse', () => {
    const getOrElse = _.getOrElse((s: string) => R.of(s.length))
    assert.deepStrictEqual(getOrElse(_.right(1))({}), 1)
    assert.deepStrictEqual(getOrElse(_.left('aaa'))({}), 3)
  })

  it('orElse', () => {
    const orElse = _.orElse((s: string) => (s.length > 2 ? _.right(1) : _.left(2)))
    assert.deepStrictEqual(orElse(_.right(1))({}), E.right(1))
  })

  describe('getSemigroup', () => {
    it('concat', () => {
      // tslint:disable-next-line: deprecation
      const S = _.getSemigroup(semigroupSum)
      const e1 = S.concat(_.left('a'), _.left('b'))({})
      assert.deepStrictEqual(e1, E.left('a'))

      const e2 = S.concat(_.left('a'), _.right(2))({})
      assert.deepStrictEqual(e2, E.right(2))

      const e3 = S.concat(_.right(1), _.left('b'))({})
      assert.deepStrictEqual(e3, E.right(1))

      const e4 = S.concat(_.right(1), _.right(2))({})
      assert.deepStrictEqual(e4, E.right(3))
    })
  })

  describe('getApplyMonoid', () => {
    // tslint:disable-next-line: deprecation
    const M = _.getApplyMonoid(S.Monoid)

    it('concat (right)', () => {
      const x = M.concat(_.right('a'), _.right('b'))({})
      return assert.deepStrictEqual(x, E.right('ab'))
    })

    it('concat (left)', () => {
      const x = M.concat(_.right('a'), _.left('b'))({})
      return assert.deepStrictEqual(x, E.left('b'))
    })

    it('empty (right)', () => {
      const x = M.concat(_.right('a'), M.empty)({})
      return assert.deepStrictEqual(x, E.right('a'))
    })

    it('empty (left)', () => {
      const x = M.concat(M.empty, _.right('a'))({})
      return assert.deepStrictEqual(x, E.right('a'))
    })
  })

  it('ask', () => {
    assert.deepStrictEqual(_.ask()({}), E.right({}))
  })

  it('asks', () => {
    assert.deepStrictEqual(_.asks((r: { readonly a: number }) => r.a)({ a: 1 }), E.right(1))
  })

  it('local', () => {
    assert.deepStrictEqual(
      // tslint:disable-next-line: deprecation
      _.local((n: number) => ({ a: n }))((r: { readonly a: number }) => E.right(r.a))(1),
      E.right(1)
    )
  })

  it('getApplicativeReaderValidation', () => {
    const A = _.getApplicativeReaderValidation(S.Monoid)
    assert.deepStrictEqual(Apply.sequenceT(A)(_.left('a'), _.left('b'))(null), E.left('ab'))
    // tslint:disable-next-line: deprecation
    const AV = _.getReaderValidation(S.Monoid)
    assert.deepStrictEqual(Apply.sequenceT(AV)(_.left('a'), _.left('b'))(null), E.left('ab'))
  })

  it('getAltReaderValidation', () => {
    const A = _.getAltReaderValidation(S.Monoid)
    assert.deepStrictEqual(A.alt(_.left('a'), () => _.left('b'))(null), E.left('ab'))
    // tslint:disable-next-line: deprecation
    const AV = _.getReaderValidation(S.Monoid)
    assert.deepStrictEqual(AV.alt(_.left('a'), () => _.left('b'))(null), E.left('ab'))
  })

  it('chainEitherK', () => {
    const f = (s: string) => (s.length === 1 ? E.right(s.length) : E.left('b'))
    assert.deepStrictEqual(pipe(_.right('a'), _.chainEitherK(f))({}), E.right(1))
    assert.deepStrictEqual(pipe(_.right('aa'), _.chainEitherK(f))({}), E.left('b'))
  })

  it('do notation', () => {
    assert.deepStrictEqual(
      pipe(
        _.right<void, string, number>(1),
        _.bindTo('a'),
        _.bind('b', () => _.right('b'))
      )(undefined),
      E.right({ a: 1, b: 'b' })
    )
  })

  it('apS', () => {
    assert.deepStrictEqual(
      pipe(_.right<void, string, number>(1), _.bindTo('a'), _.apS('b', _.right('b')))(undefined),
      E.right({ a: 1, b: 'b' })
    )
  })

  it('sequenceArray', () => {
    assert.deepStrictEqual(pipe([_.right(1), _.right(2)], _.sequenceArray)(undefined), E.right([1, 2]))
    assert.deepStrictEqual(pipe([_.right(1), _.left('a')], _.sequenceArray)(undefined), E.left('a'))
  })

  it('getCompactable', () => {
    const C = _.getCompactable(S.Monoid)
    assert.deepStrictEqual(C.compact(_.of(O.some('a')))({}), E.right('a'))
  })

  it('getFilterable', () => {
    const F = _.getFilterable(S.Monoid)
    assert.deepStrictEqual(F.filter(_.of('a'), (s) => s.length > 0)({}), E.right('a'))
    assert.deepStrictEqual(F.filterMap(_.of('a'), (s) => (s.length > 0 ? O.some(s.length) : O.none))({}), E.right(1))
    const { left: left1, right: right1 } = F.partition(_.of('a'), (s) => s.length > 0)
    assert.deepStrictEqual(left1({}), E.left(''))
    assert.deepStrictEqual(right1({}), E.right('a'))
    const { left: left2, right: right2 } = F.partitionMap(_.of('a'), (s) =>
      s.length > 0 ? E.right(s.length) : E.left(s)
    )
    assert.deepStrictEqual(left2({}), E.left(''))
    assert.deepStrictEqual(right2({}), E.right(1))
  })
})
