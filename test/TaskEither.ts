import * as assert from 'assert'
import * as E from '../src/Either'
import { pipe } from '../src/function'
import * as I from '../src/IO'
import * as IE from '../src/IOEither'
import { monoidString } from '../src/Monoid'
import { none, some } from '../src/Option'
import * as A from '../src/ReadonlyArray'
import { semigroupString } from '../src/Semigroup'
import * as T from '../src/Task'
import * as _ from '../src/TaskEither'
import { assertPar, assertSeq } from './util'

describe('TaskEither', () => {
  // -------------------------------------------------------------------------------------
  // type class members
  // -------------------------------------------------------------------------------------

  it('alt', async () => {
    assert.deepStrictEqual(
      await pipe(
        _.left('a'),
        _.alt(() => _.right(1))
      )(),
      E.right(1)
    )
  })

  it('map', async () => {
    const double = (n: number): number => n * 2
    assert.deepStrictEqual(await pipe(_.right(1), _.map(double))(), E.right(2))
  })

  it('ap', async () => {
    const double = (n: number): number => n * 2
    assert.deepStrictEqual(await pipe(_.right(double), _.ap(_.right(1)))(), E.right(2))
  })

  it('apFirst', async () => {
    assert.deepStrictEqual(await pipe(_.right('a'), _.apFirst(_.right('b')))(), E.right('a'))
  })

  it('apSecond', async () => {
    assert.deepStrictEqual(await pipe(_.right('a'), _.apSecond(_.right('b')))(), E.right('b'))
  })

  it('chain', async () => {
    assert.deepStrictEqual(
      await pipe(
        _.right('foo'),
        _.chain((a) => (a.length > 2 ? _.right(a.length) : _.left('foo')))
      )(),
      E.right(3)
    )
    assert.deepStrictEqual(
      await pipe(
        _.right('a'),
        _.chain((a) => (a.length > 2 ? _.right(a.length) : _.left('foo')))
      )(),
      E.left('foo')
    )
  })

  it('chainFirst', async () => {
    assert.deepStrictEqual(
      await pipe(
        _.right('foo'),
        _.chainFirst((a) => (a.length > 2 ? _.right(a.length) : _.left('foo')))
      )(),
      E.right('foo')
    )
  })

  it('chainFirstW', async () => {
    assert.deepStrictEqual(
      await pipe(
        _.right<string, number>('foo'),
        _.chainFirstW((a) => (a.length > 2 ? _.right(a.length) : _.left('foo')))
      )(),
      E.right('foo')
    )
  })

  it('flatten', async () => {
    assert.deepStrictEqual(await pipe(_.right(_.right('a')), _.flatten)(), E.right('a'))
  })

  it('bimap', async () => {
    const f = (s: string): number => s.length
    const g = (n: number): boolean => n > 2

    assert.deepStrictEqual(await pipe(_.right(1), _.bimap(f, g))(), E.right(false))
    assert.deepStrictEqual(await pipe(_.left('foo'), _.bimap(f, g))(), E.left(3))
  })

  it('mapLeft', async () => {
    const double = (n: number): number => n * 2
    assert.deepStrictEqual(await pipe(_.left(1), _.mapLeft(double))(), E.left(2))
  })

  // -------------------------------------------------------------------------------------
  // instances
  // -------------------------------------------------------------------------------------

  it('getApplicativeTaskValidation', async () => {
    const A = _.getApplicativeTaskValidation(T.ApplicativePar, semigroupString)
    const tuple = <A>(a: A) => <B>(b: B): readonly [A, B] => [a, b]
    assert.deepStrictEqual(await pipe(_.left('a'), A.map(tuple), A.ap(_.left('b')))(), E.left('ab'))
  })

  it('getAltTaskValidation', async () => {
    const A = _.getAltTaskValidation(semigroupString)
    assert.deepStrictEqual(
      await pipe(
        _.left('a'),
        A.alt(() => _.left('b'))
      )(),
      E.left('ab')
    )
    assert.deepStrictEqual(
      await pipe(
        _.right(1),
        A.alt(() => _.left('b'))
      )(),
      E.right(1)
    )
    assert.deepStrictEqual(
      await pipe(
        _.left('a'),
        A.alt(() => _.right(2))
      )(),
      E.right(2)
    )
  })

  describe('getCompactable', () => {
    const C = _.getCompactable(monoidString)

    it('compact', async () => {
      assert.deepStrictEqual(await C.compact(_.right(some(1)))(), E.right(1))
    })

    it('separate', async () => {
      const s1 = C.separate(_.left('a'))
      assert.deepStrictEqual(await s1.left(), E.left('a'))
      assert.deepStrictEqual(await s1.right(), E.left('a'))
      const s2 = C.separate(_.right(E.left('a')))
      assert.deepStrictEqual(await s2.left(), E.right('a'))
      assert.deepStrictEqual(await s2.right(), E.left(''))
      const s3 = C.separate(_.right(E.right(1)))
      assert.deepStrictEqual(await s3.left(), E.left(''))
      assert.deepStrictEqual(await s3.right(), E.right(1))
    })
  })

  describe('getFilterable', () => {
    const F = _.getFilterable(A.getMonoid<string>())

    it('partition', async () => {
      const { left, right } = pipe(
        _.of<string, ReadonlyArray<string>>('a'),
        F.partition((s) => s.length > 2)
      )
      assert.deepStrictEqual(await left(), E.right('a'))
      assert.deepStrictEqual(await right(), E.left([]))
    })

    it('partitionMap', async () => {
      const { left, right } = pipe(
        _.of<string, ReadonlyArray<string>>('a'),
        F.partitionMap((s) => (s.length > 2 ? E.right(s.length) : E.left(false)))
      )
      assert.deepStrictEqual(await left(), E.right(false))
      assert.deepStrictEqual(await right(), E.left([]))
    })
  })

  it('ApplicativeSeq', async () => {
    await assertSeq(_.ApplySeq, _.FromTask, (fa) => fa())
    await assertSeq(_.ApplicativeSeq, _.FromTask, (fa) => fa())
  })

  it('ApplicativePar', async () => {
    await assertPar(_.ApplyPar, _.FromTask, (fa) => fa())
    await assertPar(_.ApplicativePar, _.FromTask, (fa) => fa())
  })

  // -------------------------------------------------------------------------------------
  // utils
  // -------------------------------------------------------------------------------------

  it('taskify', async () => {
    const api1 = (_path: string, callback: (err: Error | null | undefined, result?: string) => void): void => {
      callback(null, 'ok')
    }
    const api2 = (_path: string, callback: (err: Error | null | undefined, result?: string) => void): void => {
      callback(undefined, 'ok')
    }
    const api3 = (_path: string, callback: (err: Error | null | undefined, result?: string) => void): void => {
      callback(new Error('ko'))
    }
    assert.deepStrictEqual(await _.taskify(api1)('foo')(), E.right('ok'))
    assert.deepStrictEqual(await _.taskify(api2)('foo')(), E.right('ok'))
    assert.deepStrictEqual(await _.taskify(api3)('foo')(), E.left(new Error('ko')))
  })

  it('composed taskify', async () => {
    const api = (callback: (err: Error | null | undefined, result?: string) => void): void => {
      callback(null, 'ok')
    }
    const taskApi = _.taskify(api)()

    assert.deepStrictEqual(await taskApi(), E.right('ok'))
    assert.deepStrictEqual(await taskApi(), E.right('ok'))
  })

  describe('bracket', () => {
    // tslint:disable-next-line: readonly-array
    let log: Array<string> = []

    const acquireFailure = _.left('acquire failure')
    const acquireSuccess = _.right({ res: 'acquire success' })
    const useSuccess = () => _.right('use success')
    const useFailure = () => _.left('use failure')
    const releaseSuccess = () =>
      _.rightIO(() => {
        log.push('release success')
      })
    const releaseFailure = () => _.left('release failure')

    beforeEach(() => {
      log = []
    })

    it('should return the acquire error if acquire fails', async () => {
      assert.deepStrictEqual(await _.bracket(acquireFailure, useSuccess, releaseSuccess)(), E.left('acquire failure'))
    })

    it('body and release must not be called if acquire fails', async () => {
      await _.bracket(acquireFailure, useSuccess, releaseSuccess)()
      assert.deepStrictEqual(log, [])
    })

    it('should return the use error if use fails and release does not', async () => {
      assert.deepStrictEqual(await _.bracket(acquireSuccess, useFailure, releaseSuccess)(), E.left('use failure'))
    })

    it('should return the release error if both use and release fail', async () => {
      assert.deepStrictEqual(await _.bracket(acquireSuccess, useFailure, releaseFailure)(), E.left('release failure'))
    })

    it('release must be called if the body returns', async () => {
      await _.bracket(acquireSuccess, useSuccess, releaseSuccess)()
      assert.deepStrictEqual(log, ['release success'])
    })

    it('release must be called if the body throws', async () => {
      await _.bracket(acquireSuccess, useFailure, releaseSuccess)()
      assert.deepStrictEqual(log, ['release success'])
    })

    it('should return the release error if release fails', async () => {
      assert.deepStrictEqual(await _.bracket(acquireSuccess, useSuccess, releaseFailure)(), E.left('release failure'))
    })
  })

  it('do notation', async () => {
    assert.deepStrictEqual(
      await pipe(
        _.right<number, string>(1),
        _.bindTo('a'),
        _.bind('b', () => _.right('b'))
      )(),
      E.right({ a: 1, b: 'b' })
    )
  })

  it('apS', async () => {
    assert.deepStrictEqual(
      await pipe(_.right<number, string>(1), _.bindTo('a'), _.apS('b', _.right('b')))(),
      E.right({ a: 1, b: 'b' })
    )
  })

  it('apT', async () => {
    assert.deepStrictEqual(await pipe(_.right<number, string>(1), _.tupled, _.apT(_.right('b')))(), E.right([1, 'b']))
  })

  describe('array utils', () => {
    it('sequenceReadonlyArray', async () => {
      const arr = A.range(0, 10)
      assert.deepStrictEqual(await pipe(arr, A.map(_.of), _.sequenceReadonlyArray)(), E.right(arr))
      assert.deepStrictEqual(
        await pipe(arr, A.map(_.fromPredicate((x) => x > 5)), _.sequenceReadonlyArray)(),
        E.left(0)
      )
    })

    it('traverseReadonlyArray', async () => {
      const arr = A.range(0, 10)
      assert.deepStrictEqual(await pipe(arr, _.traverseReadonlyArray(_.of))(), E.right(arr))
      assert.deepStrictEqual(await pipe(arr, _.traverseReadonlyArray(_.fromPredicate((x) => x > 5)))(), E.left(0))
    })

    it('sequenceReadonlyArraySeq', async () => {
      const arr = A.range(0, 10)
      assert.deepStrictEqual(await pipe(arr, A.map(_.of), _.sequenceReadonlyArraySeq)(), E.right(arr))
      assert.deepStrictEqual(
        await pipe(arr, A.map(_.fromPredicate((x) => x > 5)), _.sequenceReadonlyArraySeq)(),
        E.left(0)
      )
    })

    it('traverseReadonlyArraySeq', async () => {
      const arr = A.range(0, 10)
      assert.deepStrictEqual(await pipe(arr, _.traverseReadonlyArraySeq(_.of))(), E.right(arr))
      assert.deepStrictEqual(await pipe(arr, _.traverseReadonlyArraySeq(_.fromPredicate((x) => x > 5)))(), E.left(0))
    })
  })

  // -------------------------------------------------------------------------------------
  // combinators
  // -------------------------------------------------------------------------------------

  it('filterOrElse', async () => {
    assert.deepStrictEqual(
      await pipe(
        _.right(12),
        _.filterOrElse(
          (n) => n > 10,
          () => 'a'
        )
      )(),
      E.right(12)
    )
    assert.deepStrictEqual(
      await pipe(
        _.right(7),
        _.filterOrElse(
          (n) => n > 10,
          () => 'a'
        )
      )(),
      E.left('a')
    )
  })

  it('orElse', async () => {
    assert.deepStrictEqual(
      await pipe(
        _.left('foo'),
        _.orElse((l) => _.right(l.length))
      )(),
      E.right(3)
    )
    assert.deepStrictEqual(
      await pipe(
        _.right(1),
        _.orElse(() => _.right(2))
      )(),
      E.right(1)
    )
  })

  it('swap', async () => {
    assert.deepStrictEqual(await _.swap(_.right(1))(), E.left(1))
    assert.deepStrictEqual(await _.swap(_.left('a'))(), E.right('a'))
  })

  it('chainEitherK', async () => {
    const f = (s: string) => E.right(s.length)
    assert.deepStrictEqual(await pipe(_.right('a'), _.chainEitherK(f))(), E.right(1))
  })

  it('chainIOEitherK', async () => {
    const f = (s: string) => IE.right(s.length)
    assert.deepStrictEqual(await pipe(_.right('a'), _.chainIOEitherK(f))(), E.right(1))
  })

  describe('tryCatchK', () => {
    it('resolving', async () => {
      return assert.deepStrictEqual(
        await _.tryCatchK((n: number, s: string) => Promise.resolve(n + s.length))(2, '1')(),
        E.right(3)
      )
    })

    it('rejecting', async () => {
      return assert.deepStrictEqual(await _.tryCatchK(() => Promise.reject('rejected'))()(), E.left('rejected'))
    })
  })

  // -------------------------------------------------------------------------------------
  // constructors
  // -------------------------------------------------------------------------------------

  it('rightIO', async () => {
    const io = () => 1
    const fa = _.rightIO(io)
    assert.deepStrictEqual(await fa(), E.right(1))
  })

  it('leftIO', async () => {
    assert.deepStrictEqual(await _.leftIO(I.of(1))(), E.left(1))
  })

  it('tryCatch', async () => {
    assert.deepStrictEqual(await _.tryCatch(() => Promise.resolve(1))(), E.right(1))
    assert.deepStrictEqual(await _.tryCatch(() => Promise.reject('error'))(), E.left('error'))
  })

  it('fromIOEither', async () => {
    assert.deepStrictEqual(await _.fromIOEither(() => E.right(1))(), E.right(1))
    assert.deepStrictEqual(await _.fromIOEither(() => E.left('foo'))(), E.left('foo'))
  })

  it('fromOption', async () => {
    assert.deepStrictEqual(
      await pipe(
        none,
        _.fromOption(() => 'none')
      )(),
      E.left('none')
    )
    assert.deepStrictEqual(
      await pipe(
        some(1),
        _.fromOption(() => 'none')
      )(),
      E.right(1)
    )
  })

  it('fromPredicate', async () => {
    const f = _.fromPredicate((n: number) => n >= 2)
    assert.deepStrictEqual(await f(3)(), E.right(3))
    assert.deepStrictEqual(await f(1)(), E.left(1))
  })
})
