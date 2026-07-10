declare module "@jscad/stl-serializer" {
	const stlSerializer: {
		serialize: (
			options: { binary?: boolean },
			...objects: any[]
		) => string[] | ArrayBuffer[];
	};
	export default stlSerializer;
}
declare module "@jscad/modeling/src/measurements/measureBoundingBox" {
	const measureBoundingBox: (geom: any) => [number[], number[]];
	export default measureBoundingBox;
}
