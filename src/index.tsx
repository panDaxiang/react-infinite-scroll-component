// @ts-nocheck
/* eslint-disable */
import React, { Component, ReactNode, CSSProperties } from 'react';
import { throttle } from 'throttle-debounce';
import { ThresholdUnits, parseThreshold } from './utils/threshold';

type Fn = () => any;
export interface Props {
  next: Fn; // 到达底部触发的方法
  hasMore: boolean; // 列表是否有更多元素
  dataLength: number; // 列表长度
  children: ReactNode; // 子元素
  loader: ReactNode; // 滚动加载中显示的节点
  scrollThreshold?: number | string; // 滚动加载的阈值
  endMessage?: ReactNode; // 滚动到底部显示的元素

  height?: number | string; // 设置滚动区域的高度
  scrollableTarget?: ReactNode; // 滚动的元素
  hasChildren?: boolean; // 是否有子元素
  inverse?: boolean; // 设置加载更多的触发机制， true为向上滚动加载更多， false为下拉滚动加载更多

  pullDownToRefresh?: boolean; // 开启下拉刷新
  pullDownToRefreshContent?: ReactNode; // 未达到下拉阈值显示的内容
  releaseToRefreshContent?: ReactNode; // 达到下拉阈值显示的内容
  pullDownToRefreshThreshold?: number; // 下拉阈值
  refreshFunction?: Fn; // 触发下拉刷新时调用的函数

  onScroll?: (e: MouseEvent) => any; // 滚动时触发
  initialScrollY?: number; // 初始化滚动位置
  className?: string;
  style?: CSSProperties;
}

interface State {
  showLoader: boolean;
  pullToRefreshThresholdBreached: boolean;
  prevDataLength: number | undefined;
}

export default class InfiniteScroll extends Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      showLoader: false, // 加载loader
      pullToRefreshThresholdBreached: false, // 显示下拉内容状态
      prevDataLength: props.dataLength, // 上次列表数据长度
    };

    this.throttledOnScrollListener = throttle(150, this.onScrollListener).bind(
      this
    );
    this.onStart = this.onStart.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onEnd = this.onEnd.bind(this);
  }

  private throttledOnScrollListener: (e: MouseEvent) => void;
  private _scrollableNode: HTMLElement | undefined | null;
  private el: HTMLElement | undefined | Window & typeof globalThis;
  // 滚动元素
  private _infScroll: HTMLDivElement | undefined;
  private lastScrollTop = 0;
  private actionTriggered = false;
  private _pullDown: HTMLDivElement | undefined; // 下拉的元素

  // variables to keep track of pull down behaviour
  private startY = 0;
  private currentY = 0;
  private dragging = false;

  // will be populated in componentDidMount
  // based on the height of the pull down element
  private maxPullDownDistance = 0;

  static getDerivedStateFromProps(nextProps: Props, prevState: State) {
    const dataLengthChanged = nextProps.dataLength !== prevState.prevDataLength;

    // 处理数据长度变化，更新state中数据值
    if (dataLengthChanged) {
      return {
        ...prevState,
        prevDataLength: nextProps.dataLength,
      };
    }
    return null;
  }

  componentDidMount() {
    // 判断数据格式是否符合要求
    if (typeof this.props.dataLength === 'undefined') {
      throw new Error(
        `mandatory prop "dataLength" is missing. The prop is needed` +
          ` when loading more content. Check README.md for usage`
      );
    }

    // 获取滚动容器
    this._scrollableNode = this.getScrollableTarget();

    // 如果设置高度则以组件内元素作为滚动区域，否则根据传入进来的dom元素作为滚动元素
    this.el = this.props.height
      ? this._infScroll
      : this._scrollableNode || window;

    if (this.el) {
      // 绑定滚动事件
      this.el.addEventListener('scroll', this
        .throttledOnScrollListener as EventListenerOrEventListenerObject);
    }

    // 初始化Y轴方向滚动位置
    if (
      typeof this.props.initialScrollY === 'number' &&
      this.el &&
      this.el instanceof HTMLElement &&
      this.el.scrollHeight > this.props.initialScrollY
    ) {
      this.el.scrollTo(0, this.props.initialScrollY);
    }

    // 是否开启下拉加载
    if (this.props.pullDownToRefresh && this.el) {
      this.el.addEventListener('touchstart', this.onStart);
      this.el.addEventListener('touchmove', this.onMove);
      this.el.addEventListener('touchend', this.onEnd);

      this.el.addEventListener('mousedown', this.onStart);
      this.el.addEventListener('mousemove', this.onMove);
      this.el.addEventListener('mouseup', this.onEnd);

      // get BCR of pullDown element to position it above
      this.maxPullDownDistance =
        (this._pullDown &&
          this._pullDown.firstChild &&
          (this._pullDown.firstChild as HTMLDivElement).getBoundingClientRect()
            .height) ||
        0;
      this.forceUpdate();

      if (typeof this.props.refreshFunction !== 'function') {
        throw new Error(
          `Mandatory prop "refreshFunction" missing.
          Pull Down To Refresh functionality will not work
          as expected. Check README.md for usage'`
        );
      }
    }
  }

  componentDidUpdate(prevProps: Props) {
    // 列表长度不变不做处理
    if (this.props.dataLength === prevProps.dataLength) return;

    this.actionTriggered = false;

    // update state when new data was sent in
    this.setState({
      showLoader: false,
    });
  }

  componentWillUnmount() {
    // 卸载事件绑定
    if (this.el) {
      this.el.removeEventListener('scroll', this
        .throttledOnScrollListener as EventListenerOrEventListenerObject);

      if (this.props.pullDownToRefresh) {
        this.el.removeEventListener('touchstart', this.onStart);
        this.el.removeEventListener('touchmove', this.onMove);
        this.el.removeEventListener('touchend', this.onEnd);

        this.el.removeEventListener('mousedown', this.onStart);
        this.el.removeEventListener('mousemove', this.onMove);
        this.el.removeEventListener('mouseup', this.onEnd);
      }
    }
  }

  // 获取滚动容器
  getScrollableTarget = () => {
    if (this.props.scrollableTarget instanceof HTMLElement)
      return this.props.scrollableTarget;
    if (typeof this.props.scrollableTarget === 'string') {
      return document.getElementById(this.props.scrollableTarget);
    }
    if (this.props.scrollableTarget === null) {
      console.warn(`You are trying to pass scrollableTarget but it is null. This might
        happen because the element may not have been added to DOM yet.
        See https://github.com/ankeetmaini/react-infinite-scroll-component/issues/59 for more info.
      `);
    }
    return null;
  };

  onStart: EventListener = (evt: Event) => {
    if (this.lastScrollTop) return;

    // 标识拖拽状态
    this.dragging = true;

    // 记录下拉拖拽的操作位置
    if (evt instanceof MouseEvent) {
      this.startY = evt.pageY;
    } else if (evt instanceof TouchEvent) {
      this.startY = evt.touches[0].pageY;
    }

    this.currentY = this.startY;

    // 开启willchange优化
    if (this._infScroll) {
      this._infScroll.style.willChange = 'transform';
      this._infScroll.style.transition = `transform 0.2s cubic-bezier(0,0,0.31,1)`;
    }
  };

  onMove: EventListener = (evt: Event) => {
    if (!this.dragging) return;

    if (evt instanceof MouseEvent) {
      this.currentY = evt.pageY;
    } else if (evt instanceof TouchEvent) {
      this.currentY = evt.touches[0].pageY;
    }

    // 用户向上滚动，不需要处理
    if (this.currentY < this.startY) return;

    if (
      this.currentY - this.startY >=
      Number(this.props.pullDownToRefreshThreshold)
    ) {
      this.setState({
        pullToRefreshThresholdBreached: true,
      });
    }

    // so you can drag upto 1.5 times of the maxPullDownDistance
    if (this.currentY - this.startY > this.maxPullDownDistance * 1.5) return;

    if (this._infScroll) {
      this._infScroll.style.overflow = 'visible';
      this._infScroll.style.transform = `translate3d(0px, ${this.currentY -
        this.startY}px, 0px)`;
    }
  };

  onEnd: EventListener = () => {
    // 重置状态
    this.startY = 0;
    this.currentY = 0;

    this.dragging = false;

    // 如果下拉触发阈值，则执行refresh函数
    if (this.state.pullToRefreshThresholdBreached) {
      this.props.refreshFunction && this.props.refreshFunction();
      // 重置状态
      this.setState({
        pullToRefreshThresholdBreached: false,
      });
    }

    // 下一帧开始初始化样式
    requestAnimationFrame(() => {
      if (this._infScroll) {
        this._infScroll.style.overflow = 'auto';
        this._infScroll.style.transform = 'none';
        this._infScroll.style.willChange = 'unset';
      }
    });
  };

  // 判断是否滚动到顶部
  isElementAtTop(target: HTMLElement, scrollThreshold: string | number = 0.8) {
    const clientHeight =
      target === document.body || target === document.documentElement
        ? window.screen.availHeight
        : target.clientHeight;

    const threshold = parseThreshold(scrollThreshold);

    if (threshold.unit === ThresholdUnits.Pixel) {
      return (
        target.scrollTop <=
        threshold.value + clientHeight - target.scrollHeight + 1
      );
    }

    return (
      target.scrollTop <=
      threshold.value / 100 + clientHeight - target.scrollHeight + 1
    );
  }

  // 判断是否滚动到底部
  isElementAtBottom(
    target: HTMLElement,
    scrollThreshold: string | number = 0.8
  ) {
    // 滚动元素的可视高度
    const clientHeight =
      target === document.body || target === document.documentElement
        ? window.screen.availHeight
        : target.clientHeight;

    // 处理阈值的单位和数值，返回为对象
    const threshold = parseThreshold(scrollThreshold);

    // 滚动到阈值位置的时候，出发到达底部判断
    if (threshold.unit === ThresholdUnits.Pixel) {
      return (
        target.scrollTop + clientHeight >= target.scrollHeight - threshold.value
      );
    }

    // 对于百分比处理，要是滚动到达比例，则触发到达底部判断
    return (
      target.scrollTop + clientHeight >=
      (threshold.value / 100) * target.scrollHeight
    );
  }

  // 滚动事件
  onScrollListener = (event: MouseEvent) => {
    if (typeof this.props.onScroll === 'function') {
      // Execute this callback in next tick so that it does not affect the
      // functionality of the library.
      setTimeout(() => this.props.onScroll && this.props.onScroll(event), 0);
    }

    // 滚动的元素
    const target =
      this.props.height || this._scrollableNode
        ? (event.target as HTMLElement)
        : document.documentElement.scrollTop
        ? document.documentElement
        : document.body;

    // 阻止多次触发next
    if (this.actionTriggered) return;

    const atBottom = this.props.inverse
      ? this.isElementAtTop(target, this.props.scrollThreshold)
      : this.isElementAtBottom(target, this.props.scrollThreshold);

    // 根据是否到底底部和是否有更多，判断是否要触发next
    if (atBottom && this.props.hasMore) {
      this.actionTriggered = true;
      this.setState({ showLoader: true });
      this.props.next && this.props.next();
    }

    // 记录滚动的高度
    this.lastScrollTop = target.scrollTop;
  };

  render() {
    const style = {
      height: this.props.height || 'auto',
      overflow: 'auto',
      WebkitOverflowScrolling:
        'touch' /* 当手指从触摸屏上移开，会保持一段时间的滚动 */,
      ...this.props.style,
    } as CSSProperties;

    const hasChildren =
      this.props.hasChildren ||
      !!(
        this.props.children &&
        this.props.children instanceof Array &&
        this.props.children.length
      );

    // because heighted infiniteScroll visualy breaks
    // on drag down as overflow becomes visible
    const outerDivStyle =
      this.props.pullDownToRefresh && this.props.height
        ? { overflow: 'auto' }
        : {};

    return (
      <div
        style={outerDivStyle}
        className="infinite-scroll-component__outerdiv"
      >
        <div
          className={`infinite-scroll-component ${this.props.className || ''}`}
          ref={(infScroll: HTMLDivElement) => (this._infScroll = infScroll)}
          style={style}
        >
          {/* 下拉刷新 */}
          {this.props.pullDownToRefresh && (
            <div
              style={{ position: 'relative' }}
              ref={(pullDown: HTMLDivElement) => (this._pullDown = pullDown)}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: -1 * this.maxPullDownDistance,
                }}
              >
                {this.state.pullToRefreshThresholdBreached
                  ? this.props.releaseToRefreshContent
                  : this.props.pullDownToRefreshContent}
              </div>
            </div>
          )}

          {/* children */}
          {this.props.children}

          {!this.state.showLoader &&
            !hasChildren &&
            this.props.hasMore &&
            this.props.loader}

          {this.state.showLoader && this.props.hasMore && this.props.loader}

          {/* 滚动到底部显示的元素 */}
          {!this.props.hasMore && this.props.endMessage}
        </div>
      </div>
    );
  }
}
