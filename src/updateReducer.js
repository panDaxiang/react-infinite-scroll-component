function updateReducer(
  reducer,
  initialArg,
  init,
){
  const hook = updateWorkInProgressHook();
  const queue = hook.queue;
  queue.lastRenderedReducer = reducer;
  const current = currentHook;
  let baseQueue = current.baseQueue;
  const pendingQueue = queue.pending;
  if (pendingQueue !== null) {
     // 这里省略... 第一步：将 pending  queue 合并到 basequeue
  }
  if (baseQueue !== null) {
    const first = baseQueue.next;
    let newState = current.baseState;
    let newBaseState = null;
    let newBaseQueueFirst = null;
    let newBaseQueueLast = null;
    let update = first;
    
    do {
      const updateExpirationTime = update.expirationTime;
      if (updateExpirationTime < renderExpirationTime) { //优先级不足
        const clone  = {
          expirationTime: update.expirationTime,
          //...
        };
        if (newBaseQueueLast === null) {
          newBaseQueueFirst = newBaseQueueLast = clone;
          newBaseState = newState;
        } else {
          newBaseQueueLast = newBaseQueueLast.next = clone;
        }
      } else {  //此更新确实具有足够的优先级。
        if (newBaseQueueLast !== null) {
          const clone= {
            expirationTime: Sync, 
            // ...
          };
          newBaseQueueLast = newBaseQueueLast.next = clone;
        }
        /* 得到新的 state */
        newState = reducer(newState, action);
      }
      update = update.next;
    } while (update !== null && update !== first);


    if (newBaseQueueLast === null) {
      newBaseState = newState;
    } else {
      newBaseQueueLast.next = newBaseQueueFirst;
    }
    hook.memoizedState = newState;
    hook.baseState = newBaseState;
    hook.baseQueue = newBaseQueueLast;
    queue.lastRenderedState = newState;
  }
  const dispatch = queue.dispatch
  return [hook.memoizedState, dispatch];
}
