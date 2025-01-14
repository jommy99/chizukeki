import { bindActionCreators, Dispatch } from 'redux'
import { SagaIterator } from 'redux-saga'
import { put, call, cancelled } from 'redux-saga/effects'
import actionCreatorFactory, { isType, AnyAction, ActionCreator, AsyncActionCreators } from 'typescript-fsa'

// TODO: not sure why this caused trouble
//import { bindAsyncAction } from 'typescript-fsa-redux-saga'
function bindAsyncAction(
  creator: AsyncActionCreators<any, any, any>,
  throwing: boolean = false
) {
  return (worker: (params: any, ...args: any[]) => Promise<any> | SagaIterator) => {
    return function* boundAsyncActionSaga(params: any, ...args: any[]): SagaIterator {
      try {
        const result = yield (call as any)(worker, params, ...args);
        yield put(creator.done({params, result}));
        return result;
      } catch (error) {
        yield put(creator.failed({params, error}));
        if(throwing){
          throw error
        } else {
          console.error(error)
        }
      } finally {
        if (yield cancelled()) {
          yield put(creator.failed({params, error: 'cancelled'}));
        }
      }
    }
  };
}

const actionCreator = actionCreatorFactory()

type Meta = null | {[key: string]: any};

namespace Switch {
  export type IncludePayload<Payload, Return> = (payload: Payload) => Return
  export type IgnorePayload<Return> = () => Return

  export type Block<Payload, Return> = IncludePayload<Payload, Return>
    | IgnorePayload<Return>
  
  export type Cases<Start, Success, Failure, Return> = {
    started: Block<Start, Return> | Return
    done: Block<Success, Return> | Return
    failed: Block<Failure, Return> | Return
  }

  export function isUncallable<Return>(u: any): u is Return {
    return typeof (u) !== 'function'
  }

  function ignore<T>(u: any): u is T {
    return false
  }

  export function handleOptionalPayload<Payload, Return>(f: Block<Payload, Return>, payload: Payload) {
    if (ignore<IgnorePayload<Return>>(f)) {
      throw Error('impossible')
    }
    return f(payload)
  }

  export function routineSwitch<Start, Success, Failure>(
    routine: AsyncActionCreators<Start, Success, Failure>
  ) {
    return <Return>(action: AnyAction, cases: {
      started: Block<Start, Return> | Return
      done: Block<Success, Return> | Return
      failed: Block<Failure, Return> | Return
    }): Return | void => {
      if (isType(action, routine.started)) {
        return isUncallable<Return>(cases.started) ?
          cases.started :
          handleOptionalPayload(cases.started, action.payload)
      }
      if (isType(action, routine.done)) {
        return isUncallable<Return>(cases.done) ?
          cases.done :
          handleOptionalPayload(cases.done, action.payload.result)
      }
      if (isType(action, routine.failed)) {
        return isUncallable<Return>(cases.failed) ?
          cases.failed :
          handleOptionalPayload(cases.failed, action.payload.error)
      }
    }
  }
}

namespace Routine {
  export type Stage = 'STARTED' | 'DONE' | 'FAILED' | undefined
}

type Routine<Start, Success, Failure> =
  AsyncActionCreators<Start, Success, Failure>
  & {
    currentStage?: Routine.Stage,
    allTypes: Array<string>,
    trigger: ActionCreator<Start>,
    switch<Return>(action: AnyAction, cases: Switch.Cases<Start, Success, Failure, Return> ): Return | void,
    stage(action: AnyAction | string | undefined): Routine.Stage | void
  }

function expandedRoutine<Start, Success, Failure>(type: string, commonMeta?: Meta): Routine<Start, Success, Failure>{
  let routine = actionCreator.async<Start, Success, Failure>(type, commonMeta)
  return Object.assign(routine, {
    trigger: actionCreator<Start>(type),
    switch: Switch.routineSwitch<Start, Success, Failure>(routine),
    allTypes: [type, ...['STARTED', 'DONE', 'FAILED'].map(stage => `${type}_${stage}`)],
    stage(action: AnyAction | string | undefined){
      if(action === undefined){ return }
      action = typeof(action) === 'string' ? { type: action } : action
      return (
        this as Routine<Start, Success, Failure>
      ).switch<'STARTED' | 'DONE' | 'FAILED' | void>(
        action,
        {
          started: 'STARTED',
          done: 'DONE',
          failed: 'FAILED',
        }
      )
    },
    withStage(action: AnyAction | string | undefined){
      let self = this as Routine<Start, Success, Failure>
      return Object.assign({}, self, { currentStage: self.stage(action) })
    }
  })
}

export default expandedRoutine

export { Switch, bindAsyncAction, Meta, Routine }
