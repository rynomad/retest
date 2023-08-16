import { ClassicPreset as Classic, GetSchemes, NodeEditor } from 'rete';

import { Area2D, AreaExtensions, AreaPlugin } from 'rete-area-plugin';

import { VuePlugin, VueArea2D, Presets as VuePresets } from 'rete-vue-plugin';

import { DataflowEngine, DataflowNode } from 'rete-engine';
import {
  AutoArrangePlugin,
  Presets as ArrangePresets,
} from 'rete-auto-arrange-plugin';
import {
  ConnectionPlugin,
  Presets as ConnectionPresets,
} from 'rete-connection-plugin';
import {
  ContextMenuPlugin,
  ContextMenuExtra,
  Presets as ContextMenuPresets,
} from 'rete-context-menu-plugin';
import { MinimapExtra, MinimapPlugin } from 'rete-minimap-plugin';
import {
  ReroutePlugin,
  RerouteExtra,
  RerouteExtensions,
} from 'rete-connection-reroute-plugin';
import { DockPlugin, DockPresets } from 'rete-dock-plugin';
import CustomButton from '../components/CustomButton.vue';

type Node = NumberNode | AddNode | SumNode;
type Conn =
  | Connection<NumberNode, AddNode>
  | Connection<AddNode, AddNode>
  | Connection<AddNode, NumberNode>;
type Schemes = GetSchemes<Node, Conn>;

class Connection<A extends Node, B extends Node> extends Classic.Connection<
  A,
  B
> {}

const socket = new Classic.Socket('socket');

class NumberNode extends Classic.Node implements DataflowNode {
  width = 180;
  height = 120;

  constructor(initial: number, change?: (value: number) => void) {
    super('Number');

    this.addOutput('value', new Classic.Output(socket, 'Number'));
    this.addControl(
      'value',
      new Classic.InputControl('number', { initial, change })
    );
  }
  data() {
    const value = (this.controls['value'] as Classic.InputControl<'number'>)
      .value;

    return {
      value,
    };
  }
}

class AddNode extends Classic.Node<
  { left: Classic.Socket; right: Classic.Socket },
  { value: Classic.Socket },
  { value: Classic.InputControl<'number'> }
> {
  height = 190;
  width = 180;

  constructor(
    change?: () => void,
    private update?: (control: Classic.InputControl<'number'>) => void
  ) {
    super('Add');
    const left = new Classic.Input(socket, 'Left');
    const right = new Classic.Input(socket, 'Right');

    left.addControl(new Classic.InputControl('number', { initial: 0, change }));
    right.addControl(
      new Classic.InputControl('number', { initial: 0, change })
    );

    this.addInput('left', left);
    this.addInput('right', right);
    this.addControl(
      'value',
      new Classic.InputControl('number', {
        readonly: true,
      })
    );
    this.addOutput('value', new Classic.Output(socket, 'Number'));
  }

  data(inputs: { left?: number[]; right?: number[] }): { value: number } {
    const leftControl = this.inputs.left
      ?.control as Classic.InputControl<'number'>;
    const rightControl = this.inputs.right
      ?.control as Classic.InputControl<'number'>;

    const { left, right } = inputs;
    const value =
      (left ? left[0] : leftControl.value || 0) +
      (right ? right[0] : rightControl.value || 0);

    this.controls.value.setValue(value);

    if (this.update) this.update(this.controls.value);

    return { value };
  }
}

class ButtonControl extends Classic.Control {
  constructor(public label: string, public onClick: () => void) {
    super();
  }
}

class SumNode extends Classic.Node<
  Record<string, Classic.Socket>,
  { value: Classic.Socket },
  { value: Classic.InputControl<'number'>; addInput: ButtonControl }
> {
  height = 220;
  width = 180;

  private inputControls: Classic.InputControl<'number'>[] = [];

  constructor(
    change?: () => void,
    private area?: AreaPlugin<Schemes, AreaExtra>
  ) {
    super('Sum');

    this.addControl(
      'value',
      new Classic.InputControl('number', {
        readonly: true,
      })
    );
    this.addOutput('value', new Classic.Output(socket, 'Number'));

    const addButton = new ButtonControl('Add Input', () => {
      console.log('add input clicked');
      this.addNewInput(change);
    });

    this.addControl('addInput', addButton);
  }

  private addNewInput(change?: () => void) {
    const inputName = `input${this.inputControls.length}`;
    alert(inputName);
    const inputControl = new Classic.InputControl('number', {
      initial: 0,
      change,
    });
    const input = new Classic.Input(socket, inputName);

    input.addControl(inputControl);

    this.inputControls.push(inputControl);
    this.addInput(inputName, input);
    this.area?.update('node', this.id);
  }

  data(inputs: Record<string, number[]>): { value: number } {
    let sum = 0;

    this.inputControls.forEach((control, index) => {
      const inputName = `input${index}`;
      const inputValue = inputs[inputName]
        ? inputs[inputName][0]
        : control.value || 0;

      sum += inputValue;
    });

    this.controls.value.setValue(sum);

    return { value: sum };
  }
}

type AreaExtra =
  | Area2D<Schemes>
  | VueArea2D<Schemes>
  | ContextMenuExtra
  | MinimapExtra
  | RerouteExtra;

export async function createEditor(container: HTMLElement) {
  const editor = new NodeEditor<Schemes>();
  const area = new AreaPlugin<Schemes, AreaExtra>(container);

  const vueRender = new VuePlugin<Schemes, AreaExtra>();

  const contextMenu = new ContextMenuPlugin<Schemes>({
    items: ContextMenuPresets.classic.setup([
      ['Number', () => new NumberNode(1, process)],
      ['Add', () => new AddNode(process)],
    ]),
  });
  const minimap = new MinimapPlugin<Schemes>();
  const reroutePlugin = new ReroutePlugin<Schemes>();
  const dock = new DockPlugin<Schemes>();
  const connection = new ConnectionPlugin<Schemes, AreaExtra>();
  connection.addPreset(ConnectionPresets.classic.setup());

  dock.addPreset(DockPresets.classic.setup({ area, size: 100, scale: 0.6 }));

  // editor.use(readonly.root);
  editor.use(area);
  // area.use(readonly.area);

  area.use(vueRender);

  area.use(contextMenu);
  area.use(minimap);
  area.use(dock);
  area.use(connection);
  dock.add(() => new NumberNode(0, process));
  dock.add(() => new AddNode(process));
  dock.add(() => new SumNode(process, area));
  vueRender.use(reroutePlugin);

  vueRender.addPreset(
    VuePresets.classic.setup({
      customize: {
        control(data) {
          if (data.payload instanceof ButtonControl) {
            return CustomButton;
          }
          if (data.payload instanceof Classic.InputControl) {
            return VuePresets.classic.Control;
          }
        },
      },
    })
  );
  vueRender.addPreset(VuePresets.contextMenu.setup());
  vueRender.addPreset(VuePresets.minimap.setup());
  vueRender.addPreset(
    VuePresets.reroute.setup({
      contextMenu(id) {
        reroutePlugin.remove(id);
      },
      translate(id, dx, dy) {
        reroutePlugin.translate(id, dx, dy);
      },
      pointerdown(id) {
        reroutePlugin.unselect(id);
        reroutePlugin.select(id);
      },
    })
  );

  const dataflow = new DataflowEngine<Schemes>();

  editor.use(dataflow);

  const arrange = new AutoArrangePlugin<Schemes>();

  arrange.addPreset(ArrangePresets.classic.setup());

  area.use(arrange);

  await arrange.layout();

  AreaExtensions.zoomAt(area, editor.getNodes());

  AreaExtensions.simpleNodesOrder(area);

  const selector = AreaExtensions.selector();
  const accumulating = AreaExtensions.accumulateOnCtrl();

  AreaExtensions.selectableNodes(area, selector, { accumulating });
  RerouteExtensions.selectablePins(reroutePlugin, selector, accumulating);

  async function process() {
    dataflow.reset();

    editor.getNodes().forEach(async (node) => {
      const sum = await dataflow.fetch(node.id);

      console.log(node.id, 'produces', sum);

      area.update(
        'control',
        (node.controls['value'] as Classic.InputControl<'number'>).id
      );
    });
  }

  editor.addPipe((context) => {
    if (
      context.type === 'connectioncreated' ||
      context.type === 'connectionremoved'
    ) {
      process();
      // arrange.layout();
    }
    return context;
  });

  process();

  return {
    destroy: () => area.destroy(),
  };
}
