import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild
} from '@angular/core';
import { debounceTime, fromEvent } from 'rxjs';
import { ChartDatum } from 'src/app/models/dashboard/chart-datum';
import * as D3 from 'd3';
import { D3Service } from 'src/app/services/d3.service';

@Component({
  selector: 'tn-stacked-bar-chart',
  templateUrl: './stacked-bar-chart.component.html',
  styleUrls: ['./stacked-bar-chart.component.scss']
})
export class StackedBarChartComponent implements AfterViewInit {
  @Input() data!: ChartDatum[];
  @Input() color!: string;
  @Output() barSegmentClick = new EventEmitter<any>();
  barHeight = 32;

  private immutableData!: any[];
  private ctr: any;
  private xScale: any;
  private yScale: any;
  private padding: number = 0.2;
  private fontSize: number = 16;
  private radius: number = 4;
  private d3!: typeof D3;

  private transitionDuration: number = 500;
  private margin: { top: number; bottom: number; left: number; right: number } = {
    top: 30,
    bottom: 0,
    left: 60,
    right: 15
  };
  svg: any;
  colorScheme: any;
  stackData: any[];

  @ViewChild('chart', { static: true }) chart!: ElementRef;

  constructor(private d3s: D3Service) {
    this.d3 = this.d3s.getD3();
  }

  get height() {
    return this.data.length * this.barHeight;
  }

  ngAfterViewInit(): void {
    this.immutableData = !!this.data ? [...this.data] : [];
    this.svg = this.d3
      .select('#chart')
      .append('svg')
      .attr('width', '100%')
      .attr('height', this.height);

    this.ctr = this.svg.append('g');

    this.renderChart();

    fromEvent(window, 'resize')
      .pipe(debounceTime(500))
      .subscribe((event) => {
        this.resizeChart();
      });
  }

  renderChart() {
    setTimeout(() => {
      function convertObject(obj) {
        const { name, series } = obj;
        const seriesObj = series.reduce((acc, curr, index) => {
          acc[curr.name.toLowerCase()] = curr.value;
          return acc;
        }, {});

        const newObj = {
          name,
          ...seriesObj,
          ...obj
        };
        return newObj;
      }

      function addNameProperty(arr) {
        let callTypes: string[] = [];
        arr.forEach((obj) => {
          for (let key in obj) {
            if (
              key !== 'series' &&
              key !== 'name' &&
              key !== 'total' &&
              key !== 'id' &&
              key !== 'value' &&
              !callTypes.includes(key)
            ) {
              callTypes.push(key);
            }
          }
          arr.callTypes = callTypes;
        });
        return arr;
      }
      this.immutableData = this.immutableData.map((d) => convertObject(d));
      this.immutableData = addNameProperty(this.immutableData);

      this.immutableData.sort((a, b) => a.value - b.value);

      // Draw Image
      this.ctr.attr('transform', `translate(40, ${this.margin.top})`);

      // @ts-ignore
      const stackGenerator = this.d3.stack().keys(this.immutableData.callTypes);

      this.stackData = stackGenerator(this.immutableData).map((callType) => {
        callType.forEach((user) => {
          if (isNaN(user[1]) || isNaN(user[0])) {
            user[1] = 0;
            user[0] = 0;
          }
          // @ts-ignore
          user.key = callType.key;
        });
        return callType;
      });

      // Scales
      this.xScale = this.d3
        .scaleLinear()
        // @ts-ignore
        .domain([
          0,
          this.d3.max(this.stackData, (callType) => {
            return this.d3.max(callType, (user) => user[1]);
          })
        ])
        .range([this.margin.left, this.innerWidth()]);

      this.yScale = this.d3
        .scaleBand()
        .domain(this.immutableData.map((callType) => callType.name))
        .range([this.height - this.margin.top, 0])
        .padding(this.padding);

      // Colors
      const colors = [
        '#B0E0E6',
        '#89ffe6',
        '#87CEFA',
        '#00BFFF',
        '#B0C4DE',
        '#1E90FF',
        '#6495ED',
        '#4682B4',
        '#5F9EA0',
        '#009688',
        '#5b765b',
        '#4caf50',
        '#8bc34a',
        '#7B68EE',
        '#483D8B',
        '#0000FF',
        '#00008B',
        '#8A2BE2',
        '#4B0082',
        '#f2a777'
      ];

      const colorScale = this.d3
        .scaleOrdinal()
        .domain(this.stackData.map((d) => d.key))
        .range(colors)
        .unknown('#ccc');

      // Tooltip
      const Tooltip = this.d3
        .select('#chart')
        .append('div')
        .style('opacity', 0)
        .attr('class', 'tooltip')
        .style('background-color', 'white')
        .style('border', 'solid')
        .style('border-width', '2px')
        .style('border-radius', '5px')
        .style('padding', '5px')
        .style('position', 'absolute');

      // Three functions that change the tooltip when user hover / move / leave a cell
      const mouseover = function (e, d) {
        const type = d.data.name;
        const data = d.data.series.find((obj) => obj.name.toLowerCase() === d.key);
        Tooltip.html(
          `<div>
             <span style="font-weight: bold">${type}</span><br>
             ${data.name}: <span style="font-weight: bold">${data.value}</span>
           </div>`
        )
          .style('left', e.layerX + 15 + 'px')
          .style('top', e.layerY - 45 + 'px');
        Tooltip.style('opacity', 1);
        D3.select(e.target).style('opacity', 0.8);
      };
      const mousemove = function (e, d) {
        const type = d.data.name;
        const data = d.data.series.find((obj) => obj.name.toLowerCase() === d.key);
        Tooltip.html(
          `<div>
             <span style="font-weight: bold">${type}</span><br>
             ${data.name}: <span style="font-weight: bold">${data.value}</span>
           </div>`
        )
          .style('left', e.layerX + 15 + 'px')
          .style('top', e.layerY - 45 + 'px');
      };
      const mouseleave = function (e, d) {
        Tooltip.style('opacity', 0);
        D3.select(e.target).style('opacity', 1);
      };
      // Type Labels
      const mouseoverType = function (e, d) {
        Tooltip.html(
          `<div>
             <span style="font-weight: bold">${d.name}</span><br>
             Total: <span style="font-weight: bold">${d.value}</span>
           </div>`
        )
          .style('left', e.layerX + 15 + 'px')
          .style('top', e.layerY - 45 + 'px');
        Tooltip.style('opacity', 1);
        D3.select(e.target).style('opacity', 0.8);
      };
      const mousemoveType = function (e, d) {
        Tooltip.html(
          `<div>
             <span style="font-weight: bold">${d.name}</span><br>
             Total: <span style="font-weight: bold">${d.value}</span>
           </div>`
        )
          .style('left', e.layerX + 15 + 'px')
          .style('top', e.layerY - 45 + 'px');
      };

      // Draw Bars
      const callTypes = this.ctr
        .append('g')
        .classed('users', true)
        .selectAll('g')
        .data(this.stackData)
        .join('g')
        .attr('fill', (d) => colorScale(d.key))
        .attr('name', (d) => d.key);

      callTypes
        .selectAll('rect')
        .data((d) => {
          return d;
        })
        .join('rect')
        .attr('x', (d) => {
          return this.xScale(d[0]);
        })
        .attr('y', (d) => this.yScale(d.data.name))
        .attr('height', this.yScale.bandwidth())
        // .attr('rx', this.radius)
        // .attr('ry', this.radius)
        .style('cursor', 'pointer')
        .on('click', (e, d) => {
          const segmentInfo = {
            agentIds: [d.data.series.find((obj) => obj.name.toLowerCase() === d.key).id],
            callTypeIds: [d.data.id]
          };
          this.barSegmentClick.emit(segmentInfo);
        })
        .on('mouseover', (e, d) => {
          mouseover(e, d);
        })
        .on('mousemove', (e, d) => {
          mousemove(e, d);
        })
        .on('mouseleave', (e, d) => {
          mouseleave(e, d);
        })
        .transition()
        .ease(this.d3.easePolyInOut)
        .duration(this.transitionDuration)
        .attr('width', (d) => {
          if (d[1] === 0) return 0;
          return this.xScale(d[1]) - this.xScale(d[0]) + 2;
        });

      // NOTE leaving this in for future use case
      //Segment text Labels
      // callTypes
      //   .selectAll('text')
      //   .data((d) => {
      //     return d;
      //   })
      //   .join('text')
      //   .attr('x', (d) => this.xScale(d[0] + 1))
      //   .style('opacity', 0)
      //   .transition()
      //   .style('opacity', 1)
      //   .duration(this.transitionDuration)
      //   // @ts-ignore
      //   .attr('y', (d) => this.yScale(d.data.name) + this.yScale.bandwidth() / 2)
      //   .style('cursor', 'pointer')
      //   .attr('fill', 'white')
      //   .attr('dominant-baseline', 'middle')
      //   .style('font-weight', 600)
      //   .attr('class', 'text-label')
      //   .style('font-family', 'Arial')
      //   .style('font-size', this.fontSize)
      //   .text((d) => {
      //     // @ts-ignore
      //     return d.data[d.key] > 1 ? d.data[d.key] : '';
      //   });

      // Draw Axes
      const xAxis = this.d3.axisTop(this.xScale).ticks(5, '~s').tickSizeOuter(0);
      const yAxis = this.d3.axisLeft(this.yScale).tickSizeOuter(0);

      this.ctr
        .append('g')
        .attr('transform', `translate(${this.margin.left}, 0)`)
        // emit row data
        .on('click', (e, d) => {
          const barInfo = {
            agentIds: [],
            callTypeIds: [
              this.immutableData.find((datum) => datum.name == e.srcElement.__data__).id
            ]
          };
          this.barSegmentClick.emit(barInfo);
        })
        .on('mouseover', (e, d) => {
          const data = this.immutableData.find(
            (datum) => datum.name == e.srcElement.__data__
          );
          mouseoverType(e, data);
        })
        .on('mousemove', (e, d) => {
          const data = this.immutableData.find(
            (datum) => datum.name == e.srcElement.__data__
          );
          mousemoveType(e, data);
        })
        .on('mouseleave', (e, d) => {
          mouseleave(e, d);
        })
        .style('cursor', 'pointer')
        .style('font-size', 14)
        .style('font-family', 'Arial')
        .call(yAxis)
        .selectAll('.tick')
        .selectAll('text')
        .call((text) => {
          text._groups.forEach(function (nodeList) {
            const textNode = nodeList[0];
            // Get the width of the text element
            const textWidth = textNode.getBBox().width;

            // Check if the width is greater than 80 pixels
            if (textWidth > 80) {
              // Get the full text content of the element
              const fullText = D3.select(textNode).text();

              // Slice the text to fit within 40 pixels
              const slicedText = fullText.slice(0, Math.floor(75 / (14 / 2))) + '...';

              // Set the text content of the element to the sliced text
              D3.select(textNode).text(slicedText);
            }
          });
        });

      this.ctr
        .append('g')
        .attr('transform', `translate(0, ${0})`)
        .style('font-size', 14)
        .style('font-family', 'Arial')
        .style('cursor', 'none')
        .transition()
        .ease(this.d3.easePolyInOut)
        .duration(this.transitionDuration)
        .call(xAxis);
    }, 100);
  }

  resizeChart() {
    document.querySelector('#chart').innerHTML = '';
    this.svg = this.d3
      .select('#chart')
      .append('svg')
      .attr('width', '100%')
      .attr('height', this.height);

    this.ctr = this.svg.append('g');

    this.renderChart();
  }

  private innerWidth(): number {
    return (
      this.chart.nativeElement.children[0].clientWidth -
      this.margin.left -
      this.margin.right
    );
  }
}
